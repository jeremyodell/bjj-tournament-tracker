/**
 * Deploy-time policy checks for backend/template.yaml (R1 + R2).
 *
 * R1: no scheduled provider collection. Every scheduled trigger in the
 *     template (SAM Schedule/ScheduleV2 events and AWS::Events::Rule with a
 *     ScheduleExpression) must be disabled under every parameter set we deploy
 *     with (template defaults, each samconfig.toml env, each CI
 *     --parameter-overrides). Today every schedule in the template drives an
 *     external fetcher (IBJJF, JJWL, Amadeus), so "no enabled schedule" is the
 *     rule. Unknown expressions count as enabled (fail closed).
 *
 * R2: every API route that is not on the public catalog allowlist declares an
 *     authorizer. Routes on resources whose Condition is false in every
 *     parameter set are reported as inactive, not checked.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

export type Template = {
  Parameters?: Record<string, { Default?: unknown }>;
  Conditions?: Record<string, unknown>;
  Resources?: Record<string, { Type: string; Condition?: string; Properties?: Record<string, unknown> }>;
};

export type ParamSet = { source: string; values: Record<string, string> };

/**
 * Public catalog routes: tournament listings and the gym directory. They return
 * tournament and gym directory fields only, never athlete or user data. Any
 * route added here must stay free of athlete/minor data.
 */
export const PUBLIC_CATALOG_ROUTES: ReadonlySet<string> = new Set([
  'GET /tournaments',
  'GET /tournaments/{id}',
  'GET /gyms',
  'GET /gyms/{org}/{externalId}',
  'GET /master-gyms/search',
  'GET /master-gyms/{id}',
]);

// ---------- YAML with CloudFormation short-form tags ----------

const scalarFn = (tag: string, fn: string, map?: (s: string) => unknown) =>
  new yaml.Type(tag, { kind: 'scalar', construct: (d: string) => ({ [fn]: map ? map(d) : d }) });
const seqFn = (tag: string, fn: string) =>
  new yaml.Type(tag, { kind: 'sequence', construct: (d: unknown[]) => ({ [fn]: d }) });
const mapFn = (tag: string, fn: string) =>
  new yaml.Type(tag, { kind: 'mapping', construct: (d: unknown) => ({ [fn]: d }) });

const CFN_SCHEMA = yaml.DEFAULT_SCHEMA.extend([
  scalarFn('!Ref', 'Ref'),
  scalarFn('!Condition', 'Condition'),
  scalarFn('!Sub', 'Fn::Sub'),
  seqFn('!Sub', 'Fn::Sub'),
  scalarFn('!GetAtt', 'Fn::GetAtt', (s) => s.split('.')),
  seqFn('!GetAtt', 'Fn::GetAtt'),
  scalarFn('!ImportValue', 'Fn::ImportValue'),
  mapFn('!ImportValue', 'Fn::ImportValue'),
  scalarFn('!Base64', 'Fn::Base64'),
  scalarFn('!GetAZs', 'Fn::GetAZs'),
  ...['Equals', 'If', 'Not', 'And', 'Or', 'Join', 'Select', 'Split', 'FindInMap', 'Cidr'].map((n) =>
    seqFn(`!${n}`, `Fn::${n}`)
  ),
]);

export function parseTemplate(text: string): Template {
  return yaml.load(text, { schema: CFN_SCHEMA }) as Template;
}

// ---------- parameter sets ----------

function parseOverrides(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([A-Za-z0-9]+)=("[^"]*"|'[^']*'|\S+)/g)) {
    out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

/** parameter_overrides per [env.deploy.parameters] section of samconfig.toml. */
export function samconfigParamSets(text: string): ParamSet[] {
  const sets: ParamSet[] = [];
  let section = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) {
      section = header[1];
      continue;
    }
    const m = line.match(/^parameter_overrides\s*=\s*(.+)$/);
    if (m) {
      let v = m[1].trim();
      if (v.startsWith('[')) {
        // TOML array form: ["A=1", "B=2"]
        v = [...v.matchAll(/"([^"]*)"/g)].map((x) => x[1]).join(' ');
      } else {
        v = v.replace(/^"|"$/g, '').replace(/\\"/g, '"');
      }
      sets.push({ source: `samconfig.toml [${section}]`, values: parseOverrides(v) });
    }
  }
  return sets;
}

/** `--parameter-overrides ...` found in CI workflow files. */
export function workflowParamSets(name: string, text: string): ParamSet[] {
  const sets: ParamSet[] = [];
  for (const m of text.matchAll(/--parameter-overrides\s+([^\n]+)/g)) {
    sets.push({ source: `${name}: --parameter-overrides`, values: parseOverrides(m[1].replace(/\s--\S.*$/, '')) });
  }
  return sets;
}

/** Merge each set over the template defaults; include the bare defaults too. */
export function resolveParamSets(template: Template, sets: ParamSet[]): ParamSet[] {
  const defaults: Record<string, string> = {};
  for (const [k, p] of Object.entries(template.Parameters ?? {})) {
    if (p && p.Default !== undefined) defaults[k] = String(p.Default);
  }
  return [{ source: 'template defaults', values: defaults }, ...sets].map((s) => ({
    source: s.source,
    values: { ...defaults, ...s.values },
  }));
}

// ---------- tiny intrinsic evaluator (fail closed) ----------

const UNKNOWN = Symbol('unknown');
type Val = string | boolean | typeof UNKNOWN;

function evalExpr(expr: unknown, t: Template, params: Record<string, string>, depth = 0): Val {
  if (depth > 20) return UNKNOWN;
  if (typeof expr === 'boolean') return expr;
  if (typeof expr === 'string') {
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    return expr;
  }
  if (expr && typeof expr === 'object' && !Array.isArray(expr)) {
    const [[fn, arg]] = Object.entries(expr as Record<string, unknown>);
    switch (fn) {
      case 'Ref':
        return typeof arg === 'string' && arg in params ? params[arg] : UNKNOWN;
      case 'Condition':
        return evalCondition(String(arg), t, params, depth + 1);
      case 'Fn::Equals': {
        const [a, b] = (arg as unknown[]).map((x) => evalExpr(x, t, params, depth + 1));
        if (a === UNKNOWN || b === UNKNOWN) return UNKNOWN;
        return String(a) === String(b);
      }
      case 'Fn::Not': {
        const v = evalExpr((arg as unknown[])[0], t, params, depth + 1);
        return typeof v === 'boolean' ? !v : UNKNOWN;
      }
      case 'Fn::And':
      case 'Fn::Or': {
        const vals = (arg as unknown[]).map((x) => evalExpr(x, t, params, depth + 1));
        if (vals.some((v) => typeof v !== 'boolean')) return UNKNOWN;
        return fn === 'Fn::And' ? vals.every(Boolean) : vals.some(Boolean);
      }
      case 'Fn::If': {
        const [cond, a, b] = arg as unknown[];
        const c = evalCondition(String(cond), t, params, depth + 1);
        if (typeof c !== 'boolean') return UNKNOWN;
        return evalExpr(c ? a : b, t, params, depth + 1);
      }
    }
  }
  return UNKNOWN;
}

export function evalCondition(name: string, t: Template, params: Record<string, string>, depth = 0): Val {
  const c = t.Conditions?.[name];
  if (c === undefined) return UNKNOWN;
  return evalExpr(c, t, params, depth);
}

function resourceActive(t: Template, cond: string | undefined, params: Record<string, string>): boolean {
  if (!cond) return true;
  return evalCondition(cond, t, params) !== false; // unknown => active
}

// ---------- R1: schedules ----------

export type ScheduleFinding = { id: string; source: string; reason: string };

function scheduleOn(props: Record<string, unknown>, t: Template, params: Record<string, string>): [boolean, string] {
  if ('Enabled' in props) {
    const v = evalExpr(props.Enabled, t, params);
    if (v === false) return [false, 'Enabled=false'];
    return [true, v === UNKNOWN ? 'Enabled is not statically false' : `Enabled=${String(v)}`];
  }
  if ('State' in props) {
    const v = evalExpr(props.State, t, params);
    if (v === 'DISABLED') return [false, 'State=DISABLED'];
    return [true, v === UNKNOWN ? 'State is not statically DISABLED' : `State=${String(v)}`];
  }
  return [true, 'no Enabled/State (schedules default to enabled)'];
}

export function findEnabledSchedules(t: Template, paramSets: ParamSet[]): ScheduleFinding[] {
  const out: ScheduleFinding[] = [];
  for (const ps of paramSets) {
    for (const [id, r] of Object.entries(t.Resources ?? {})) {
      if (!resourceActive(t, r.Condition, ps.values)) continue;
      const props = r.Properties ?? {};
      if (r.Type === 'AWS::Serverless::Function' || r.Type === 'AWS::Serverless::StateMachine') {
        const events = (props.Events ?? {}) as Record<string, { Type: string; Properties?: Record<string, unknown> }>;
        for (const [eid, e] of Object.entries(events)) {
          if (e.Type !== 'Schedule' && e.Type !== 'ScheduleV2') continue;
          const [on, why] = scheduleOn(e.Properties ?? {}, t, ps.values);
          if (on) out.push({ id: `${id}.${eid}`, source: ps.source, reason: why });
        }
      }
      if ((r.Type === 'AWS::Events::Rule' && 'ScheduleExpression' in props) || r.Type === 'AWS::Scheduler::Schedule') {
        const [on, why] = scheduleOn(props, t, ps.values);
        if (on) out.push({ id, source: ps.source, reason: why });
      }
    }
  }
  return out;
}

// ---------- R2: authorizers ----------

export type RouteInfo = { route: string; resource: string; authorizer: string | null; active: boolean };

export function listApiRoutes(t: Template, paramSets: ParamSet[]): RouteInfo[] {
  const routes: RouteInfo[] = [];
  const resources = t.Resources ?? {};
  const active = (cond?: string) => paramSets.some((ps) => resourceActive(t, cond, ps.values));

  // API-level default authorizers (AWS::Serverless::Api / HttpApi)
  const apiDefault: Record<string, string | null> = {};
  for (const [id, r] of Object.entries(resources)) {
    if (r.Type === 'AWS::Serverless::Api' || r.Type === 'AWS::Serverless::HttpApi') {
      const auth = (r.Properties?.Auth ?? {}) as { DefaultAuthorizer?: string };
      apiDefault[id] = auth.DefaultAuthorizer && auth.DefaultAuthorizer !== 'NONE' ? auth.DefaultAuthorizer : null;
    }
  }

  for (const [id, r] of Object.entries(resources)) {
    if (r.Type === 'AWS::Serverless::Function') {
      const events = (r.Properties?.Events ?? {}) as Record<string, { Type: string; Properties?: Record<string, unknown> }>;
      for (const [eid, e] of Object.entries(events)) {
        if (e.Type !== 'Api' && e.Type !== 'HttpApi') continue;
        const p = e.Properties ?? {};
        const method = String(p.Method ?? 'ANY').toUpperCase();
        const route = `${method} ${String(p.Path)}`;
        const apiRef = (p.RestApiId ?? p.ApiId) as { Ref?: string } | undefined;
        const def = apiRef?.Ref ? apiDefault[apiRef.Ref] ?? null : null;
        const own = (p.Auth as { Authorizer?: string } | undefined)?.Authorizer;
        const authorizer = own === undefined ? def : own === 'NONE' ? null : own;
        routes.push({ route, resource: `${id}.${eid}`, authorizer, active: active(r.Condition) });
      }
    }
    if (r.Type === 'AWS::ApiGatewayV2::Route' || r.Type === 'AWS::ApiGateway::Method') {
      const p = r.Properties ?? {};
      const type = String(p.AuthorizationType ?? 'NONE');
      const route =
        r.Type === 'AWS::ApiGatewayV2::Route' ? `ROUTE ${String(p.RouteKey)}` : `${String(p.HttpMethod)} (raw method ${id})`;
      // $disconnect cannot carry an authorizer; it only runs on an authorized connection.
      if (p.RouteKey === '$disconnect') continue;
      routes.push({ route, resource: id, authorizer: type === 'NONE' ? null : type, active: active(r.Condition) });
    }
  }
  return routes;
}

export function findUnauthorizedRoutes(
  t: Template,
  paramSets: ParamSet[],
  allowlist: ReadonlySet<string> = PUBLIC_CATALOG_ROUTES
): RouteInfo[] {
  return listApiRoutes(t, paramSets).filter((r) => r.active && !r.authorizer && !allowlist.has(r.route));
}

// ---------- repo loader ----------

export function loadRepoPolicyInputs(backendDir: string): { template: Template; paramSets: ParamSet[] } {
  const template = parseTemplate(readFileSync(join(backendDir, 'template.yaml'), 'utf8'));
  const sets: ParamSet[] = [];
  const samconfig = join(backendDir, 'samconfig.toml');
  if (existsSync(samconfig)) sets.push(...samconfigParamSets(readFileSync(samconfig, 'utf8')));
  const wfDir = join(backendDir, '..', '.github', 'workflows');
  if (existsSync(wfDir)) {
    for (const f of readdirSync(wfDir).filter((x) => /\.ya?ml$/.test(x))) {
      sets.push(...workflowParamSets(`.github/workflows/${f}`, readFileSync(join(wfDir, f), 'utf8')));
    }
  }
  return { template, paramSets: resolveParamSets(template, sets) };
}
