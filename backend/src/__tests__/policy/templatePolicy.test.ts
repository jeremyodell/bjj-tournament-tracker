import { describe, it, expect } from '@jest/globals';
import { join } from 'node:path';
import {
  parseTemplate,
  samconfigParamSets,
  workflowParamSets,
  resolveParamSets,
  findEnabledSchedules,
  findUnauthorizedRoutes,
  listApiRoutes,
  loadRepoPolicyInputs,
} from '../../policy/templatePolicy.js';

const BASE = `
Parameters:
  EnableScheduledSync:
    Type: String
    Default: 'false'
  EnableX:
    Type: String
    Default: 'false'
Conditions:
  XOn: !Equals [!Ref EnableX, 'true']
Resources:
  Api:
    Type: AWS::Serverless::Api
    Properties:
      Auth:
        Authorizers:
          CognitoAuthorizer: {}
`;

const fn = (events: string) => `
  Fn1:
    Type: AWS::Serverless::Function
    Properties:
      Events:
${events}`;

function check(yamlText: string, samconfig = '') {
  const t = parseTemplate(yamlText);
  const sets = resolveParamSets(t, samconfigParamSets(samconfig));
  return { t, sets };
}

describe('R1: findEnabledSchedules', () => {
  it('flags a schedule with Enabled: true', () => {
    const { t, sets } = check(BASE + fn(`        S:\n          Type: Schedule\n          Properties:\n            Schedule: rate(1 day)\n            Enabled: true\n`));
    expect(findEnabledSchedules(t, sets).map((f) => f.id)).toContain('Fn1.S');
  });

  it('flags a schedule with no Enabled (defaults to on)', () => {
    const { t, sets } = check(BASE + fn(`        S:\n          Type: Schedule\n          Properties:\n            Schedule: rate(1 day)\n`));
    expect(findEnabledSchedules(t, sets)).toHaveLength(1);
  });

  it('passes a schedule with Enabled: false', () => {
    const { t, sets } = check(BASE + fn(`        S:\n          Type: Schedule\n          Properties:\n            Schedule: rate(1 day)\n            Enabled: false\n`));
    expect(findEnabledSchedules(t, sets)).toEqual([]);
  });

  it('flags a param-gated schedule when any samconfig env turns it on', () => {
    const tpl = BASE + fn(`        S:\n          Type: Schedule\n          Properties:\n            Schedule: rate(1 day)\n            Enabled: !Equals [!Ref EnableScheduledSync, 'true']\n`);
    const off = check(tpl, '[default.deploy.parameters]\nparameter_overrides = "Stage=dev EnableScheduledSync=false"\n');
    expect(findEnabledSchedules(off.t, off.sets)).toEqual([]);
    const on = check(tpl, '[prod.deploy.parameters]\nparameter_overrides = "Stage=prod EnableScheduledSync=true"\n');
    const findings = findEnabledSchedules(on.t, on.sets);
    expect(findings).toHaveLength(1);
    expect(findings[0].source).toBe('samconfig.toml [prod.deploy.parameters]');
  });

  it('flags a workflow --parameter-overrides that turns a schedule on', () => {
    const t = parseTemplate(BASE + fn(`        S:\n          Type: Schedule\n          Properties:\n            Schedule: rate(1 day)\n            Enabled: !Equals [!Ref EnableScheduledSync, 'true']\n`));
    const sets = resolveParamSets(t, workflowParamSets('ci.yml', 'run: sam deploy --parameter-overrides Stage=dev EnableScheduledSync=true'));
    expect(findEnabledSchedules(t, sets)).toHaveLength(1);
  });

  it('fails closed on an Enabled expression it cannot evaluate', () => {
    const { t, sets } = check(BASE + fn(`        S:\n          Type: Schedule\n          Properties:\n            Schedule: rate(1 day)\n            Enabled: !Ref SomethingUnknown\n`));
    expect(findEnabledSchedules(t, sets)).toHaveLength(1);
  });

  it('checks EventBridge rules only when their condition is on', () => {
    const tpl = BASE + `
  Rule:
    Type: AWS::Events::Rule
    Condition: XOn
    Properties:
      ScheduleExpression: cron(0 4 * * ? *)
      State: ENABLED
`;
    const off = check(tpl);
    expect(findEnabledSchedules(off.t, off.sets)).toEqual([]);
    const on = check(tpl, '[x.deploy.parameters]\nparameter_overrides = "EnableX=true"\n');
    expect(findEnabledSchedules(on.t, on.sets).map((f) => f.id)).toEqual(['Rule']);
  });
});

describe('R2: findUnauthorizedRoutes', () => {
  let n = 0;
  const api = (path: string, method: string, auth = '') =>
    `        E${++n}:\n          Type: Api\n          Properties:\n            RestApiId: !Ref Api\n            Path: ${path}\n            Method: ${method}\n${auth ? `            Auth:\n              Authorizer: ${auth}\n` : ''}`;

  it('flags a non-catalog route without an authorizer', () => {
    const { t, sets } = check(BASE + fn(api('/gyms/{org}/{externalId}/roster/{tournamentId}', 'GET')));
    expect(findUnauthorizedRoutes(t, sets).map((r) => r.route)).toEqual([
      'GET /gyms/{org}/{externalId}/roster/{tournamentId}',
    ]);
  });

  it('allows catalog routes without an authorizer', () => {
    const { t, sets } = check(BASE + fn(api('/tournaments', 'GET') + api('/master-gyms/{id}', 'GET')));
    expect(findUnauthorizedRoutes(t, sets)).toEqual([]);
  });

  it('allowlist is method-specific', () => {
    const { t, sets } = check(BASE + fn(api('/tournaments', 'POST')));
    expect(findUnauthorizedRoutes(t, sets)).toHaveLength(1);
  });

  it('treats Authorizer: NONE as no authorizer', () => {
    const { t, sets } = check(BASE + fn(api('/athletes', 'GET', 'NONE')));
    expect(findUnauthorizedRoutes(t, sets)).toHaveLength(1);
  });

  it('passes a route with the Cognito authorizer', () => {
    const { t, sets } = check(BASE + fn(api('/athletes', 'GET', 'CognitoAuthorizer')));
    expect(findUnauthorizedRoutes(t, sets)).toEqual([]);
  });

  it('flags an unauthenticated WebSocket $connect only when its resource is deployed', () => {
    const tpl = BASE + `
  Connect:
    Type: AWS::ApiGatewayV2::Route
    Condition: XOn
    Properties:
      RouteKey: $connect
      AuthorizationType: NONE
`;
    const off = check(tpl);
    expect(findUnauthorizedRoutes(off.t, off.sets)).toEqual([]);
    expect(listApiRoutes(off.t, off.sets)[0].active).toBe(false);
    const on = check(tpl, '[x.deploy.parameters]\nparameter_overrides = "EnableX=true"\n');
    expect(findUnauthorizedRoutes(on.t, on.sets).map((r) => r.route)).toEqual(['ROUTE $connect']);
  });
});

describe('repository template (backend/template.yaml)', () => {
  const backendDir = join(process.cwd());
  const { template, paramSets } = loadRepoPolicyInputs(backendDir);

  it('checks the prod samconfig env and the CI deploy overrides', () => {
    const sources = paramSets.map((p) => p.source);
    expect(sources).toContain('samconfig.toml [prod.deploy.parameters]');
    expect(sources.some((s) => s.startsWith('.github/workflows/'))).toBe(true);
  });

  it('R1: has no enabled schedule under any deploy parameter set', () => {
    expect(findEnabledSchedules(template, paramSets)).toEqual([]);
  });

  it('R1: prod deploys with EnableScheduledSync=false', () => {
    const prod = paramSets.find((p) => p.source === 'samconfig.toml [prod.deploy.parameters]');
    expect(prod?.values.EnableScheduledSync).toBe('false');
  });

  it('R2: every non-catalog route declares an authorizer', () => {
    expect(findUnauthorizedRoutes(template, paramSets)).toEqual([]);
  });

  it('R0: the gym roster route is not exposed', () => {
    const routes = listApiRoutes(template, paramSets).map((r) => r.route);
    expect(routes.filter((r) => r.includes('/roster'))).toEqual([]);
  });
});
