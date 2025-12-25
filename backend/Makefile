.PHONY: build-SyncFunction

build-SyncFunction:
	npm ci
	npm run build
	rm -rf node_modules
	npm ci --omit=dev
	cp -r dist $(ARTIFACTS_DIR)/
	cp -r node_modules $(ARTIFACTS_DIR)/
	cp package.json $(ARTIFACTS_DIR)/
