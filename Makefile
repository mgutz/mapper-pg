SHELL := /bin/bash

test: setup test-unit test-integration

setup:
	@[ -e ".mapper.json" ] || node test/bootstrap/init.js

test-unit:
	@node_modules/.bin/mocha --bail -R spec test/unit/queryBuilderTest.js

test-integration:
	@node_modules/.bin/mocha --bail -R spec test/integration/clientTest.js
	@node_modules/.bin/mocha --bail -R spec test/integration/integrationTest.js

bench: setup
	time node test/bench/testPg.js
	time node test/bench/testMapperDao.js

server:
	node example/app.js
