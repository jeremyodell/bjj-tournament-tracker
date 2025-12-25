.PHONY: build-SyncFunction

build-SyncFunction:
	npm ci --omit=dev
	npm run build
	cp -r dist $(ARTIFACTS_DIR)/
	cp -r node_modules $(ARTIFACTS_DIR)/
	cp package.json $(ARTIFACTS_DIR)/
