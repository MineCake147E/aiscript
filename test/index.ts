/* eslint-disable prefer-const */
/**
 * Tests!
 */

import * as assert from 'assert';
import { Parser, Interpreter, utils, errors, Ast } from '../src';
import { NUM, STR, NULL, ARR, OBJ, BOOL, TRUE, FALSE } from '../src/interpreter/value';

const exe = (program: string): Promise<any> => new Promise((ok, err) => {
	const aiscript = new Interpreter({}, {
		out(value) {
			ok(value);
		},
		maxStep: 9999,
	});

	const parser = new Parser();
	const ast = parser.parse(program);
	aiscript.exec(ast).catch(err);
});

const getMeta = (program: string) => {
	const parser = new Parser();
	const ast = parser.parse(program);

	const metadata = Interpreter.collectMetadata(ast);

	return metadata;
};

const eq = (a, b) => {
	assert.deepEqual(a.type, b.type);
	assert.deepEqual(a.value, b.value);
};

it('Hello, world!', async () => {
	const res = await exe('<: "Hello, world!"');
	eq(res, STR('Hello, world!'));
});

it('empty script', async () => {
	const parser = new Parser();
	const ast = parser.parse('');
	assert.deepEqual(ast, []);
});

describe('Interpreter', () => {
	describe('Scope', () => {
		it('getAll', async () => {
			const aiscript = new Interpreter({});
			await aiscript.exec(Parser.parse(`
			let a = 1
			@b() {
				let x = a + 1
				x
			}
			if true {
				var y = 2
			}
			var c = true
			`));
			const vars = aiscript.scope.getAll();
			assert.ok(vars.get('a') != null);
			assert.ok(vars.get('b') != null);
			assert.ok(vars.get('c') != null);
			assert.ok(vars.get('x') == null);
			assert.ok(vars.get('y') == null);
		});
	});
});

describe('ops', () => {
	it('==', async () => {
		eq(await exe('<: (1 == 1)'), BOOL(true));
		eq(await exe('<: (1 == 2)'), BOOL(false));
	});

	it('!=', async () => {
		eq(await exe('<: (1 != 2)'), BOOL(true));
		eq(await exe('<: (1 != 1)'), BOOL(false));
	});

	it('&&', async () => {
		eq(await exe('<: (true && true)'), BOOL(true));
		eq(await exe('<: (true && false)'), BOOL(false));
		eq(await exe('<: (false && true)'), BOOL(false));
		eq(await exe('<: (false && false)'), BOOL(false));
	});

	it('||', async () => {
		eq(await exe('<: (true || true)'), BOOL(true));
		eq(await exe('<: (true || false)'), BOOL(true));
		eq(await exe('<: (false || true)'), BOOL(true));
		eq(await exe('<: (false || false)'), BOOL(false));
	});

	it('+', async () => {
		eq(await exe('<: (1 + 1)'), NUM(2));
	});

	it('-', async () => {
		eq(await exe('<: (1 - 1)'), NUM(0));
	});

	it('*', async () => {
		eq(await exe('<: (1 * 1)'), NUM(1));
	});

	it('/', async () => {
		eq(await exe('<: (1 / 1)'), NUM(1));
	});

	it('%', async () => {
		eq(await exe('<: (1 % 1)'), NUM(0));
	});

	it('>', async () => {
		eq(await exe('<: (2 > 1)'), BOOL(true));
		eq(await exe('<: (1 > 1)'), BOOL(false));
		eq(await exe('<: (0 > 1)'), BOOL(false));
	});

	it('<', async () => {
		eq(await exe('<: (2 < 1)'), BOOL(false));
		eq(await exe('<: (1 < 1)'), BOOL(false));
		eq(await exe('<: (0 < 1)'), BOOL(true));
	});

	it('>=', async () => {
		eq(await exe('<: (2 >= 1)'), BOOL(true));
		eq(await exe('<: (1 >= 1)'), BOOL(true));
		eq(await exe('<: (0 >= 1)'), BOOL(false));
	});

	it('<=', async () => {
		eq(await exe('<: (2 <= 1)'), BOOL(false));
		eq(await exe('<: (1 <= 1)'), BOOL(true));
		eq(await exe('<: (0 <= 1)'), BOOL(true));
	});

	it('precedence', async () => {
		eq(await exe('<: 1 + 2 * 3 + 4'), NUM(11));
		eq(await exe('<: 1 + 4 / 4 + 1'), NUM(3));
		eq(await exe('<: 1 + 1 == 2 && 2 * 2 == 4'), BOOL(true));
		eq(await exe('<: (1 + 1) * 2'), NUM(4));
	});

});

describe('Infix expression', () => {
	it('simple infix expression', async () => {
		eq(await exe('<: 0 < 1'), BOOL(true));
		eq(await exe('<: 1 + 1'), NUM(2));
	});

	it('combination', async () => {
		eq(await exe('<: 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10'), NUM(55));
		eq(await exe('<: Core:add(1, 3) * Core:mul(2, 5)'), NUM(40));
	});

	it('use parentheses to distinguish expr', async () => {
		eq(await exe('<: (1 + 10) * (2 + 5)'), NUM(77));
	});

	it('syntax symbols vs infix operators', async () => {
		const res = await exe(`
		<: match true {
			1 == 1 => "true"
			1 < 1 => "false"
		}
		`);
		eq(res, STR('true'));
	});

	it('number + if expression', async () => {
		eq(await exe('<: 1 + if true 1 else 2'), NUM(2));
	});

	it('number + match expression', async () => {
		const res = await exe(`
			<: 1 + match 2 == 2 {
				true => 3
				false  => 4
			}
		`);
		eq(res, NUM(4));
	});

	it('eval + eval', async () => {
		eq(await exe('<: eval { 1 } + eval { 1 }'), NUM(2));
	});

	it('disallow line break', async () => {
		try {
			await exe(`
			<: 1 +
			1 + 1
			`);
		} catch (e) {
			assert.ok(true);
			return;
		}
		assert.fail();
	});

	it('escaped line break', async () => {
		eq(await exe(`
			<: 1 + \\
			1 + 1
		`), NUM(3));
	});
});

it('Escaped double quote', async () => {
	const res = await exe('<: "ai saw a note \\"bebeyo\\"."');
	eq(res, STR('ai saw a note "bebeyo".'));
});

it('//', async () => {
	const res = await exe('<: "//"');
	eq(res, STR('//'));
});

it('式にコロンがあってもオブジェクトと判定されない', async () => {
	const res = await exe(`
	<: eval {
		Core:eq("ai", "ai")
	}
	`);
	eq(res, BOOL(true));
});

it('inc', async () => {
	const res = await exe(`
	var a = 0
	a += 1
	a += 2
	a += 3
	<: a
	`);
	eq(res, NUM(6));
});

it('dec', async () => {
	const res = await exe(`
	var a = 0
	a -= 1
	a -= 2
	a -= 3
	<: a
	`);
	eq(res, NUM(-6));
});

it('var', async () => {
	const res = await exe(`
	let a = 42
	<: a
	`);
	eq(res, NUM(42));
});

it('参照が繋がらない', async () => {
	const res = await exe(`
	var f = @() { "a" }
	var g = f
	f = @() { "b" }

	<: g()
	`);
	eq(res, STR('a'));
});

describe('Cannot put multiple statements in a line', () => {
	it('var def', async () => {
		try {
			await exe(`
			let a = 42 let b = 11
			`);
		} catch (e) {
			assert.ok(true);
			return;
		}
		assert.fail();
	});

	it('var def (op)', async () => {
		try {
			await exe(`
			let a = 13 + 75 let b = 24 + 146
			`);
		} catch (e) {
			assert.ok(true);
			return;
		}
		assert.fail();
	});
});

it('empty function', async () => {
	const res = await exe(`
	@hoge() { }
	<: hoge()
	`);
	eq(res, NULL);
});

it('empty lambda', async () => {
	const res = await exe(`
	let hoge = @() { }
	<: hoge()
	`);
	eq(res, NULL);
});

it('lambda that returns an object', async () => {
	const res = await exe(`
	let hoge = @() {{}}
	<: hoge()
	`);
	eq(res, OBJ(new Map()));
});

it('Closure', async () => {
	const res = await exe(`
	@store(v) {
		let state = v
		@() {
			state
		}
	}
	let s = store("ai")
	<: s()
	`);
	eq(res, STR('ai'));
});

it('Closure (counter)', async () => {
	const res = await exe(`
	@create_counter() {
		var count = 0
		{
			get_count: @() { count };
			count: @() { count = (count + 1) };
		}
	}

	let counter = create_counter()
	let get_count = counter.get_count
	let count = counter.count

	count()
	count()
	count()

	<: get_count()
	`);
	eq(res, NUM(3));
});

it('Recursion', async () => {
	const res = await exe(`
	@fact(n) {
		if (n == 0) { 1 } else { (fact((n - 1)) * n) }
	}

	<: fact(5)
	`);
	eq(res, NUM(120));
});

describe('Var name starts with reserved word', () => {
	it('let', async () => {
		const res = await exe(`
		@f() {
			let letcat = "ai"
			letcat
		}
		<: f()
		`);
		eq(res, STR('ai'));
	});

	it('var', async () => {
		const res = await exe(`
		@f() {
			let varcat = "ai"
			varcat
		}
		<: f()
		`);
		eq(res, STR('ai'));
	});

	it('return', async () => {
		const res = await exe(`
		@f() {
			let returncat = "ai"
			returncat
		}
		<: f()
		`);
		eq(res, STR('ai'));
	});

	it('each', async () => {
		const res = await exe(`
		@f() {
			let eachcat = "ai"
			eachcat
		}
		<: f()
		`);
		eq(res, STR('ai'));
	});

	it('for', async () => {
		const res = await exe(`
		@f() {
			let forcat = "ai"
			forcat
		}
		<: f()
		`);
		eq(res, STR('ai'));
	});

	it('loop', async () => {
		const res = await exe(`
		@f() {
			let loopcat = "ai"
			loopcat
		}
		<: f()
		`);
		eq(res, STR('ai'));
	});

	it('break', async () => {
		const res = await exe(`
		@f() {
			let breakcat = "ai"
			breakcat
		}
		<: f()
		`);
		eq(res, STR('ai'));
	});

	it('continue', async () => {
		const res = await exe(`
		@f() {
			let continuecat = "ai"
			continuecat
		}
		<: f()
		`);
		eq(res, STR('ai'));
	});

	it('if', async () => {
		const res = await exe(`
		@f() {
			let ifcat = "ai"
			ifcat
		}
		<: f()
		`);
		eq(res, STR('ai'));
	});

	it('match', async () => {
		const res = await exe(`
		@f() {
			let matchcat = "ai"
			matchcat
		}
		<: f()
		`);
		eq(res, STR('ai'));
	});

	it('true', async () => {
		const res = await exe(`
		@f() {
			let truecat = "ai"
			truecat
		}
		<: f()
		`);
		eq(res, STR('ai'));
	});

	it('false', async () => {
		const res = await exe(`
		@f() {
			let falsecat = "ai"
			falsecat
		}
		<: f()
		`);
		eq(res, STR('ai'));
	});

	it('null', async () => {
		const res = await exe(`
		@f() {
			let nullcat = "ai"
			nullcat
		}
		<: f()
		`);
		eq(res, STR('ai'));
	});
});

describe('name validation of reserved word', () => {
	it('def', async () => {
		try {
			await exe(`
			let let = 1
			`);
		} catch (e) {
			assert.ok(true);
			return;
		}
		assert.fail();
	});

	it('attr', async () => {
		try {
			await exe(`
			#[let 1]
			@f() { 1 }
			`);
		} catch (e) {
			assert.ok(true);
			return;
		}
		assert.fail();
	});

	it('ns', async () => {
		try {
			await exe(`
			:: let {
				@f() { 1 }
			}
			`);
		} catch (e) {
			assert.ok(true);
			return;
		}
		assert.fail();
	});

	it('var', async () => {
		try {
			await exe(`
			let
			`);
		} catch (e) {
			assert.ok(true);
			return;
		}
		assert.fail();
	});

	it('prop', async () => {
		try {
			await exe(`
			let x = { let: 1 }
			x.let
			`);
		} catch (e) {
			assert.ok(true);
			return;
		}
		assert.fail();
	});

	it('meta', async () => {
		try {
			await exe(`
			### let 1
			`);
		} catch (e) {
			assert.ok(true);
			return;
		}
		assert.fail();
	});

	it('fn', async () => {
		try {
			await exe(`
			@let() { 1 }
			`);
		} catch (e) {
			assert.ok(true);
			return;
		}
		assert.fail();
	});
});

describe('Object', () => {
	it('property access', async () => {
		const res = await exe(`
		let obj = {
			a: {
				b: {
					c: 42;
				};
			};
		}

		<: obj.a.b.c
		`);
		eq(res, NUM(42));
	});

	it('property access (fn call)', async () => {
		const res = await exe(`
		@f() { 42 }

		let obj = {
			a: {
				b: {
					c: f;
				};
			};
		}

		<: obj.a.b.c()
		`);
		eq(res, NUM(42));
	});

	it('property assign', async () => {
		const res = await exe(`
		let obj = {
			a: 1
			b: {
				c: 2
				d: {
					e: 3
				}
			}
		}

		obj.a = 24
		obj.b.d.e = 42

		<: obj
		`);
		eq(res, OBJ(new Map<string, any>([
			['a', NUM(24)],
			['b', OBJ(new Map<string, any>([
				['c', NUM(2)],
				['d', OBJ(new Map<string, any>([
					['e', NUM(42)],
				]))],
			]))],
		])));
	});

	/* 未実装
	it('string key', async () => {
		const res = await exe(`
		let obj = {
			"藍": 42;
		}

		<: obj."藍"
		`);
		eq(res, NUM(42));
	});

	it('string key including colon and period', async () => {
		const res = await exe(`
		let obj = {
			":.:": 42;
		}

		<: obj.":.:"
		`);
		eq(res, NUM(42));
	});

	it('expression key', async () => {
		const res = await exe(`
		let key = "藍"

		let obj = {
			<key>: 42;
		}

		<: obj<key>
		`);
		eq(res, NUM(42));
	});
	*/
});

describe('Array', () => {
	it('Array item access', async () => {
		const res = await exe(`
		let arr = ["ai", "chan", "kawaii"]

		<: arr[1]
		`);
		eq(res, STR('chan'));
	});

	it('Array item assign', async () => {
		const res = await exe(`
		let arr = ["ai", "chan", "kawaii"]

		arr[1] = "taso"

		<: arr
		`);
		eq(res, ARR([STR('ai'), STR('taso'), STR('kawaii')]));
	});
});

describe('chain', () => {
	it('chain access (prop + index + call)', async () => {
		const res = await exe(`
		let obj = {
			a: {
				b: [@(name) { name }, @(str) { "chan" }, @() { "kawaii" }];
			};
		}

		<: obj.a.b[0]("ai")
		`);
		eq(res, STR('ai'));
	});

	it('chained assign left side (prop + index)', async () => {
		const res = await exe(`
		let obj = {
			a: {
				b: ["ai", "chan", "kawaii"];
			};
		}

		obj.a.b[1] = "taso"

		<: obj
		`);
		eq(res, OBJ(new Map([
			['a', OBJ(new Map([
				['b', ARR([STR('ai'), STR('taso'), STR('kawaii')])]
			]))]
		])));
	});

	it('chained assign right side (prop + index + call)', async () => {
		const res = await exe(`
		let obj = {
			a: {
				b: ["ai", "chan", "kawaii"];
			};
		}

		var x = null
		x = obj.a.b[1]

		<: x
		`);
		eq(res, STR('chan'));
	});

	it('chained inc/dec left side (index + prop)', async () => {
		const res = await exe(`
		let arr = [
			{
				a: 1;
				b: 2;
			}
		]

		arr[0].a += 1
		arr[0].b -= 1

		<: arr
		`);
		eq(res, ARR([
			OBJ(new Map([
				['a', NUM(2)],
				['b', NUM(1)]
			]))
		]));
	});

	it('chained inc/dec left side (prop + index)', async () => {
		const res = await exe(`
		let obj = {
			a: {
				b: [1, 2, 3];
			};
		}

		obj.a.b[1] += 1
		obj.a.b[2] -= 1

		<: obj
		`);
		eq(res, OBJ(new Map([
			['a', OBJ(new Map([
				['b', ARR([NUM(1), NUM(3), NUM(2)])]
			]))]
		])));
	});

	it('prop in def', async () => {
		const res = await exe(`
		let x = @() {
			let obj = {
				a: 1
			}
			obj.a
		}

		<: x()
		`);
		eq(res, NUM(1));
	});

	it('prop in return', async () => {
		const res = await exe(`
		let x = @() {
			let obj = {
				a: 1
			}
			return obj.a
			2
		}

		<: x()
		`);
		eq(res, NUM(1));
	});

	it('prop in each', async () => {
		const res = await exe(`
		let msgs = []
		let x = { a: ["ai", "chan", "kawaii"] }
		each let item, x.a {
			let y = { a: item }
			msgs.push([y.a, "!"].join())
		}
		<: msgs
		`);
		eq(res, ARR([STR('ai!'), STR('chan!'), STR('kawaii!')]));
	});

	it('prop in for', async () => {
		const res = await exe(`
		let x = { times: 10, count: 0 }
		for (let i, x.times) {
			x.count = (x.count + i)
		}
		<: x.count
		`);
		eq(res, NUM(55));
	});
});

describe('Template syntax', () => {
	it('Basic', async () => {
		const res = await exe(`
		let str = "kawaii"
		<: \`Ai is {str}!\`
		`);
		eq(res, STR('Ai is kawaii!'));
	});

	it('convert to str', async () => {
		const res = await exe(`
		<: \`1 + 1 = {(1 + 1)}\`
		`);
		eq(res, STR('1 + 1 = 2'));
	});

	it('Escape', async () => {
		const res = await exe(`
		let message = "Hello"
		<: \`\\\`a\\{b\\}c\\\`\`
		`);
		eq(res, STR('`a{b}c`'));
	});
});

it('Throws error when divied by zero', async () => {
	try {
		await exe(`
		<: (0 / 0)
		`);
	} catch (e) {
		assert.ok(true);
		return;
	}
	assert.fail();
});

describe('Function call', () => {
	it('without args', async () => {
		const res = await exe(`
		@f() {
			42
		}
		<: f()
		`);
		eq(res, NUM(42));
	});

	it('with args', async () => {
		const res = await exe(`
		@f(x) {
			x
		}
		<: f(42)
		`);
		eq(res, NUM(42));
	});

	it('with args (separated by comma)', async () => {
		const res = await exe(`
		@f(x, y) {
			(x + y)
		}
		<: f(1, 1)
		`);
		eq(res, NUM(2));
	});

	it('with args (separated by space)', async () => {
		const res = await exe(`
		@f(x y) {
			(x + y)
		}
		<: f(1 1)
		`);
		eq(res, NUM(2));
	});
	
	it('std: throw AiScript error when required arg missing', async () => {
		try {
			await exe(`
			<: Core:eq(1)
			`);
		} catch (e) {
			assert.equal(e instanceof errors.RuntimeError, true);
			return;
		}
		assert.fail();
	});
});

describe('Return', () => {
	it('Early return', async () => {
		const res = await exe(`
		@f() {
			if true {
				return "ai"
			}

			"pope"
		}
		<: f()
		`);
		eq(res, STR('ai'));
	});

	it('Early return (nested)', async () => {
		const res = await exe(`
		@f() {
			if true {
				if true {
					return "ai"
				}
			}

			"pope"
		}
		<: f()
		`);
		eq(res, STR('ai'));
	});

	it('Early return (nested) 2', async () => {
		const res = await exe(`
		@f() {
			if true {
				return "ai"
			}

			"pope"
		}

		@g() {
			if (f() == "ai") {
				return "kawaii"
			}

			"pope"
		}

		<: g()
		`);
		eq(res, STR('kawaii'));
	});

	it('Early return without block', async () => {
		const res = await exe(`
		@f() {
			if true return "ai"

			"pope"
		}
		<: f()
		`);
		eq(res, STR('ai'));
	});

	it('return inside for', async () => {
		const res = await exe(`
		@f() {
			var count = 0
			for (let i, 100) {
				count += 1
				if (i == 42) {
					return count
				}
			}
		}
		<: f()
		`);
		eq(res, NUM(42));
	});

	it('return inside loop', async () => {
		const res = await exe(`
		@f() {
			var count = 0
			loop {
				count += 1
				if (count == 42) {
					return count
				}
			}
		}
		<: f()
		`);
		eq(res, NUM(42));
	});
});

describe('Eval', () => {
	it('returns value', async () => {
		const res = await exe(`
		let foo = eval {
			let a = 1
			let b = 2
			(a + b)
		}

		<: foo
		`);
		eq(res, NUM(3));
	});
});

describe('if', () => {
	it('if', async () => {
		const res1 = await exe(`
		var msg = "ai"
		if true {
			msg = "kawaii"
		}
		<: msg
		`);
		eq(res1, STR('kawaii'));

		const res2 = await exe(`
		var msg = "ai"
		if false {
			msg = "kawaii"
		}
		<: msg
		`);
		eq(res2, STR('ai'));
	});

	it('else', async () => {
		const res1 = await exe(`
		var msg = null
		if true {
			msg = "ai"
		} else {
			msg = "kawaii"
		}
		<: msg
		`);
		eq(res1, STR('ai'));

		const res2 = await exe(`
		var msg = null
		if false {
			msg = "ai"
		} else {
			msg = "kawaii"
		}
		<: msg
		`);
		eq(res2, STR('kawaii'));
	});

	it('elif', async () => {
		const res1 = await exe(`
		var msg = "bebeyo"
		if false {
			msg = "ai"
		} elif true {
			msg = "kawaii"
		}
		<: msg
		`);
		eq(res1, STR('kawaii'));

		const res2 = await exe(`
		var msg = "bebeyo"
		if false {
			msg = "ai"
		} elif false {
			msg = "kawaii"
		}
		<: msg
		`);
		eq(res2, STR('bebeyo'));
	});

	it('if ~ elif ~ else', async () => {
		const res1 = await exe(`
		var msg = null
		if false {
			msg = "ai"
		} elif true {
			msg = "chan"
		} else {
			msg = "kawaii"
		}
		<: msg
		`);
		eq(res1, STR('chan'));

		const res2 = await exe(`
		var msg = null
		if false {
			msg = "ai"
		} elif false {
			msg = "chan"
		} else {
			msg = "kawaii"
		}
		<: msg
		`);
		eq(res2, STR('kawaii'));
	});

	it('expr', async () => {
		const res1 = await exe(`
		<: if true "ai" else "kawaii"
		`);
		eq(res1, STR('ai'));

		const res2 = await exe(`
		<: if false "ai" else "kawaii"
		`);
		eq(res2, STR('kawaii'));
	});
});

describe('match', () => {
	it('Basic', async () => {
		const res = await exe(`
		<: match 2 {
			1 => "a"
			2 => "b"
			3 => "c"
		}
		`);
		eq(res, STR('b'));
	});

	it('When default not provided, returns null', async () => {
		const res = await exe(`
		<: match 42 {
			1 => "a"
			2 => "b"
			3 => "c"
		}
		`);
		eq(res, NULL);
	});

	it('With default', async () => {
		const res = await exe(`
		<: match 42 {
			1 => "a"
			2 => "b"
			3 => "c"
			* => "d"
		}
		`);
		eq(res, STR('d'));
	});

	it('With block', async () => {
		const res = await exe(`
		<: match 2 {
			1 => 1
			2 => {
				let a = 1
				let b = 2
				(a + b)
			}
			3 => 3
		}
		`);
		eq(res, NUM(3));
	});

	it('With return', async () => {
		const res = await exe(`
		@f(x) {
			match x {
				1 => {
					return "ai"
				}
			}
			"foo"
		}
		<: f(1)
		`);
		eq(res, STR('ai'));
	});
});

describe('loop', () => {
	it('Basic', async () => {
		const res = await exe(`
		var count = 0
		loop {
			if (count == 10) break
			count = (count + 1)
		}
		<: count
		`);
		eq(res, NUM(10));
	});

	it('with continue', async () => {
		const res = await exe(`
		var a = ["ai" "chan" "kawaii" "!"]
		var b = []
		loop {
			var x = a.shift()
			if (x == "chan") continue
			if (x == "!") break
			b.push(x)
		}
		<: b
		`);
		eq(res, ARR([STR('ai'), STR('kawaii')]));
	});
});

describe('for', () => {
	it('Basic', async () => {
		const res = await exe(`
		var count = 0
		for (let i, 10) {
			count = (count + i)
		}
		<: count
		`);
		eq(res, NUM(55));
	});

	it('wuthout iterator', async () => {
		const res = await exe(`
		var count = 0
		for (10) {
			count = (count + 1)
		}
		<: count
		`);
		eq(res, NUM(10));
	});

	it('without brackets', async () => {
		const res = await exe(`
		var count = 0
		for let i, 10 {
			count = (count + i)
		}
		<: count
		`);
		eq(res, NUM(55));
	});

	it('Break', async () => {
		const res = await exe(`
		var count = 0
		for (let i, 20) {
			if (i == 11) break
			count = (count + i)
		}
		<: count
		`);
		eq(res, NUM(55));
	});

	it('continue', async () => {
		const res = await exe(`
		var count = 0
		for (let i, 10) {
			if (i == 5) continue
			count = (count + 1)
		}
		<: count
		`);
		eq(res, NUM(9));
	});

	it('single statement', async () => {
		const res = await exe(`
		var count = 0
		for 10 count += 1
		<: count
		`);
		eq(res, NUM(10));
	});
});

describe('for of', () => {
	it('standard', async () => {
		const res = await exe(`
		let msgs = []
		each let item, ["ai", "chan", "kawaii"] {
			msgs.push([item, "!"].join())
		}
		<: msgs
		`);
		eq(res, ARR([STR('ai!'), STR('chan!'), STR('kawaii!')]));
	});

	it('Break', async () => {
		const res = await exe(`
		let msgs = []
		each let item, ["ai", "chan", "kawaii"] {
			if (item == "kawaii") break
			msgs.push([item, "!"].join())
		}
		<: msgs
		`);
		eq(res, ARR([STR('ai!'), STR('chan!')]));
	});

	it('single statement', async () => {
		const res = await exe(`
		let msgs = []
		each let item, ["ai", "chan", "kawaii"] msgs.push([item, "!"].join())
		<: msgs
		`);
		eq(res, ARR([STR('ai!'), STR('chan!'), STR('kawaii!')]));
	});
});

describe('namespace', () => {
	it('standard', async () => {
		const res = await exe(`
		<: Foo:bar()

		:: Foo {
			@bar() { "ai" }
		}
		`);
		eq(res, STR('ai'));
	});

	it('self ref', async () => {
		const res = await exe(`
		<: Foo:bar()

		:: Foo {
			let ai = "kawaii"
			@bar() { ai }
		}
		`);
		eq(res, STR('kawaii'));
	});

	it('assign variable', async () => {
		const res = await exe(`
		Foo:setMsg("hello")
		<: Foo:getMsg()

		:: Foo {
			var msg = "ai"
			@setMsg(value) { Foo:msg = value }
			@getMsg() { Foo:msg }
		}
		`);
		eq(res, STR('hello'));
	});

	it('increment', async () => {
		const res = await exe(`
		Foo:value += 10
		Foo:value -= 5
		<: Foo:value

		:: Foo {
			var value = 0
		}
		`);
		eq(res, NUM(5));
	});
});

describe('literal', () => {
	it('bool (true)', async () => {
		const res = await exe(`
		<: true
		`);
		eq(res, BOOL(true));
	});

	it('bool (false)', async () => {
		const res = await exe(`
		<: false
		`);
		eq(res, BOOL(false));
	});

	it('number (Int)', async () => {
		const res = await exe(`
		<: 10
		`);
		eq(res, NUM(10));
	});

	it('number (Float)', async () => {
		const res = await exe(`
		<: 0.5
		`);
		eq(res, NUM(0.5));
	});

	it('arr (separated by comma)', async () => {
		const res = await exe(`
		<: [1, 2, 3]
		`);
		eq(res, ARR([NUM(1), NUM(2), NUM(3)]));
	});

	it('arr (separated by comma) (with trailing comma)', async () => {
		const res = await exe(`
		<: [1, 2, 3,]
		`);
		eq(res, ARR([NUM(1), NUM(2), NUM(3)]));
	});

	it('arr (separated by line break)', async () => {
		const res = await exe(`
		<: [
			1
			2
			3
		]
		`);
		eq(res, ARR([NUM(1), NUM(2), NUM(3)]));
	});

	it('arr (separated by line break and comma)', async () => {
		const res = await exe(`
		<: [
			1,
			2,
			3
		]
		`);
		eq(res, ARR([NUM(1), NUM(2), NUM(3)]));
	});

	it('arr (separated by line break and comma) (with trailing comma)', async () => {
		const res = await exe(`
		<: [
			1,
			2,
			3,
		]
		`);
		eq(res, ARR([NUM(1), NUM(2), NUM(3)]));
	});

	it('obj (separated by comma)', async () => {
		const res = await exe(`
		<: { a: 1, b: 2, c: 3 }
		`);
		eq(res, OBJ(new Map([['a', NUM(1)], ['b', NUM(2)], ['c', NUM(3)]])));
	});

	it('obj (separated by comma) (with trailing comma)', async () => {
		const res = await exe(`
		<: { a: 1, b: 2, c: 3, }
		`);
		eq(res, OBJ(new Map([['a', NUM(1)], ['b', NUM(2)], ['c', NUM(3)]])));
	});

	it('obj (separated by semicolon)', async () => {
		const res = await exe(`
		<: { a: 1; b: 2; c: 3 }
		`);
		eq(res, OBJ(new Map([['a', NUM(1)], ['b', NUM(2)], ['c', NUM(3)]])));
	});

	it('obj (separated by semicolon) (with trailing semicolon)', async () => {
		const res = await exe(`
		<: { a: 1; b: 2; c: 3; }
		`);
		eq(res, OBJ(new Map([['a', NUM(1)], ['b', NUM(2)], ['c', NUM(3)]])));
	});

	it('obj (separated by line break)', async () => {
		const res = await exe(`
		<: {
			a: 1
			b: 2
			c: 3
		}
		`);
		eq(res, OBJ(new Map([['a', NUM(1)], ['b', NUM(2)], ['c', NUM(3)]])));
	});

	it('obj (separated by line break and semicolon)', async () => {
		const res = await exe(`
		<: {
			a: 1;
			b: 2;
			c: 3
		}
		`);
		eq(res, OBJ(new Map([['a', NUM(1)], ['b', NUM(2)], ['c', NUM(3)]])));
	});

	it('obj (separated by line break and semicolon) (with trailing semicolon)', async () => {
		const res = await exe(`
		<: {
			a: 1;
			b: 2;
			c: 3;
		}
		`);
		eq(res, OBJ(new Map([['a', NUM(1)], ['b', NUM(2)], ['c', NUM(3)]])));
	});

	it('obj and arr (separated by line break)', async () => {
		const res = await exe(`
		<: {
			a: 1
			b: [
				1
				2
				3
			]
			c: 3
		}
		`);
		eq(res, OBJ(new Map<string, any>([
			['a', NUM(1)],
			['b', ARR([NUM(1), NUM(2), NUM(3)])],
			['c', NUM(3)]
		])));
	});
});

describe('type declaration', () => {
	it('def', async () => {
		const res = await exe(`
		let abc: num = 1
		var xyz: str = "abc"
		<: [abc xyz]
		`);
		eq(res, ARR([NUM(1), STR('abc')]));
	});

	it('fn def', async () => {
		const res = await exe(`
		@f(x: arr<num>, y: str, z: @(num) => bool): arr<num> {
			x[3] = 0
			y = "abc"
			var r: bool = z(x[0])
			x[4] = if r 5 else 10
			x
		}

		<: f([1, 2, 3], "a", @(n) { n == 1 })
		`);
		eq(res, ARR([NUM(1), NUM(2), NUM(3), NUM(0), NUM(5)]));
	});
});

describe('meta', () => {
	it('default meta', async () => {
		const res = getMeta(`
		### { a: 1; b: 2; c: 3; }
		`);
		eq(res, new Map([
			[null, {
				a: 1,
				b: 2,
				c: 3,
			}]
		]));
		eq(res!.get(null), {
			a: 1,
			b: 2,
			c: 3,
		});
	});

	describe('String', () => {
		it('valid', async () => {
			const res = getMeta(`
			### x "hoge"
			`);
			eq(res, new Map([
				['x', 'hoge']
			]));
		});
	});

	describe('Number', () => {
		it('valid', async () => {
			const res = getMeta(`
			### x 42
			`);
			eq(res, new Map([
				['x', 42]
			]));
		});
	});

	describe('Boolean', () => {
		it('valid', async () => {
			const res = getMeta(`
			### x true
			`);
			eq(res, new Map([
				['x', true]
			]));
		});
	});

	describe('Null', () => {
		it('valid', async () => {
			const res = getMeta(`
			### x null
			`);
			eq(res, new Map([
				['x', null]
			]));
		});
	});

	describe('Array', () => {
		it('valid', async () => {
			const res = getMeta(`
			### x [1 2 3]
			`);
			eq(res, new Map([
				['x', [1, 2, 3]]
			]));
		});

		it('invalid', async () => {
			try {
				getMeta(`
				### x [1 (2 + 2) 3]
				`);
			} catch (e) {
				assert.ok(true);
				return;
			}
			assert.fail();
		});
	});

	describe('Object', () => {
		it('valid', async () => {
			const res = getMeta(`
			### x { a: 1; b: 2; c: 3; }
			`);
			eq(res, new Map([
				['x', {
					a: 1,
					b: 2,
					c: 3,
				}]
			]));
		});

		it('invalid', async () => {
			try {
				getMeta(`
				### x { a: 1; b: (2 + 2); c: 3; }
				`);
			} catch (e) {
				assert.ok(true);
				return;
			}
			assert.fail();
		});
	});

	describe('Template', () => {
		it('invalid', async () => {
			try {
				getMeta(`
				### x \`foo {bar} baz\`
				`);
			} catch (e) {
				assert.ok(true);
				return;
			}
			assert.fail();
		});
	});

	describe('Expression', () => {
		it('invalid', async () => {
			try {
				getMeta(`
				### x (1 + 1)
				`);
			} catch (e) {
				assert.ok(true);
				return;
			}
			assert.fail();
		});
	});
});

describe('lang version', () => {
	it('number', async () => {
		const res = utils.getLangVersion(`
		/// @2021
		@f(x) {
			x
		}
		`);
		assert.strictEqual(res, '2021');
	});

	it('chars', async () => {
		const res = utils.getLangVersion(`
		/// @ canary
		const a = 1
		@f(x) {
			x
		}
		f(a)
		`);
		assert.strictEqual(res, 'canary');
	});

	it('complex', async () => {
		const res = utils.getLangVersion(`
		/// @ 2.0-Alpha
		@f(x) {
			x
		}
		`);
		assert.strictEqual(res, '2.0-Alpha');
	});

	it('no specified', async () => {
		const res = utils.getLangVersion(`
		@f(x) {
			x
		}
		`);
		assert.strictEqual(res, null);
	});
});

describe('Attribute', () => {
	it('single attribute with function (str)', async () => {
		let node: Ast.Node;
		let attr: Ast.Attribute;
		const parser = new Parser();
		const nodes = parser.parse(`
		#[Event "Recieved"]
		@onRecieved(data) {
			data
		}
		`);
		assert.equal(nodes.length, 1);
		node = nodes[0];
		if (node.type != 'def') assert.fail();
		assert.equal(node.name, 'onRecieved');
		assert.equal(node.attr.length, 1);
		// attribute 1
		attr = node.attr[0];
		if (attr.type != 'attr') assert.fail();
		assert.equal(attr.name, 'Event');
		if (attr.value.type != 'str') assert.fail();
		assert.equal(attr.value.value, 'Recieved');
	});

	it('multiple attributes with function (obj, str, bool)', async () => {
		let node: Ast.Node;
		let attr: Ast.Attribute;
		const parser = new Parser();
		const nodes = parser.parse(`
		#[Endpoint { path: "/notes/create"; }]
		#[Desc "Create a note."]
		#[Cat true]
		@createNote(text) {
			<: text
		}
		`);
		assert.equal(nodes.length, 1);
		node = nodes[0];
		if (node.type != 'def') assert.fail();
		assert.equal(node.name, 'createNote');
		assert.equal(node.attr.length, 3);
		// attribute 1
		attr = node.attr[0];
		if (attr.type != 'attr') assert.fail();
		assert.equal(attr.name, 'Endpoint');
		if (attr.value.type != 'obj') assert.fail();
		assert.equal(attr.value.value.size, 1);
		for (const [k, v] of attr.value.value) {
			if (k == 'path') {
				if (v.type != 'str') assert.fail();
				assert.equal(v.value, '/notes/create');
			}
			else {
				assert.fail();
			}
		}
		// attribute 2
		attr = node.attr[1];
		if (attr.type != 'attr') assert.fail();
		assert.equal(attr.name, 'Desc');
		if (attr.value.type != 'str') assert.fail();
		assert.equal(attr.value.value, 'Create a note.');
		// attribute 3
		attr = node.attr[2];
		if (attr.type != 'attr') assert.fail();
		assert.equal(attr.name, 'Cat');
		if (attr.value.type != 'bool') assert.fail();
		assert.equal(attr.value.value, true);
	});

	// TODO: attributed function in block
	// TODO: attribute target does not exist

	it('single attribute (no value)', async () => {
		let node: Ast.Node;
		let attr: Ast.Attribute;
		const parser = new Parser();
		const nodes = parser.parse(`
		#[serializable]
		let data = 1
		`);
		assert.equal(nodes.length, 1);
		node = nodes[0];
		if (node.type != 'def') assert.fail();
		assert.equal(node.name, 'data');
		assert.equal(node.attr.length, 1);
		// attribute 1
		attr = node.attr[0];
		assert.ok(attr.type == 'attr');
		assert.equal(attr.name, 'serializable');
		if (attr.value.type != 'bool') assert.fail();
		assert.equal(attr.value.value, true);
	});
});

describe('Location', () => {
	it('function', async () => {
		let node: Ast.Node;
		const parser = new Parser();
		const nodes = parser.parse(`
		@f(a) { a }
		`);
		assert.equal(nodes.length, 1);
		node = nodes[0];
		if (!node.loc) assert.fail();
		assert.deepEqual(node.loc, { start: 3, end: 13 });
	});
});

describe('primitive props', () => {
	describe('num', () => {
		it('to_str', async () => {
			const res = await exe(`
			let num = 123
			<: num.to_str()
			`);
			eq(res, STR('123'));
		});
	});

	describe('str', () => {
		it('len', async () => {
			const res = await exe(`
			let str = "hello"
			<: str.len
			`);
			eq(res, NUM(5));
		});

		it('to_num', async () => {
			const res = await exe(`
			let str = "123"
			<: str.to_num()
			`);
			eq(res, NUM(123));
		});

		it('upper', async () => {
			const res = await exe(`
			let str = "hello"
			<: str.upper()
			`);
			eq(res, STR('HELLO'));
		});

		it('lower', async () => {
			const res = await exe(`
			let str = "HELLO"
			<: str.lower()
			`);
			eq(res, STR('hello'));
		});

		it('trim', async () => {
			const res = await exe(`
			let str = " hello  "
			<: str.trim()
			`);
			eq(res, STR('hello'));
		});

		it('replace', async () => {
			const res = await exe(`
			let str = "hello"
			<: str.replace("l", "x")
			`);
			eq(res, STR('hexxo'));
		});

		it('index_of', async () => {
			const res = await exe(`
			let str = "hello"
			<: str.index_of("l")
			`);
			eq(res, NUM(2));
		});

		it('incl', async () => {
			const res = await exe(`
			let str = "hello"
			<: [str.incl("ll"), str.incl("x")]
			`);
			eq(res, ARR([TRUE, FALSE]));
		});

		it('split', async () => {
			const res = await exe(`
			let str = "a,b,c"
			<: str.split(",")
			`);
			eq(res, ARR([STR('a'), STR('b'), STR('c')]));
		});

		it('pick', async () => {
			const res = await exe(`
			let str = "hello"
			<: str.pick(1)
			`);
			eq(res, STR('e'));
		});

		it('slice', async () => {
			const res = await exe(`
			let str = "hello"
			<: str.slice(1, 3)
			`);
			eq(res, STR('el'));
		});
	});

	describe('arr', () => {
		it('len', async () => {
			const res = await exe(`
			let arr = [1, 2, 3]
			<: arr.len
			`);
			eq(res, NUM(3));
		});

		it('push', async () => {
			const res = await exe(`
			let arr = [1, 2, 3]
			arr.push(4)
			<: arr
			`);
			eq(res, ARR([NUM(1), NUM(2), NUM(3), NUM(4)]));
		});

		it('unshift', async () => {
			const res = await exe(`
			let arr = [1, 2, 3]
			arr.unshift(4)
			<: arr
			`);
			eq(res, ARR([NUM(4), NUM(1), NUM(2), NUM(3)]));
		});

		it('pop', async () => {
			const res = await exe(`
			let arr = [1, 2, 3]
			let popped = arr.pop()
			<: [popped, arr]
			`);
			eq(res, ARR([NUM(3), ARR([NUM(1), NUM(2)])]));
		});

		it('shift', async () => {
			const res = await exe(`
			let arr = [1, 2, 3]
			let shifted = arr.shift()
			<: [shifted, arr]
			`);
			eq(res, ARR([NUM(1), ARR([NUM(2), NUM(3)])]));
		});

		it('concat', async () => {
			const res = await exe(`
			let arr = [1, 2, 3]
			let concated = arr.concat([4, 5])
			<: [concated, arr]
			`);
			eq(res, ARR([
				ARR([NUM(1), NUM(2), NUM(3), NUM(4), NUM(5)]),
				ARR([NUM(1), NUM(2), NUM(3)])
			]));
		});

		it('slice', async () => {
			const res = await exe(`
			let arr = ["ant", "bison", "camel", "duck", "elephant"]
			let sliced = arr.slice(2, 4)
			<: [sliced, arr]
			`);
			eq(res, ARR([
				ARR([STR('camel'), STR('duck')]),
				ARR([STR('ant'), STR('bison'), STR('camel'), STR('duck'), STR('elephant')])
			]));
		});

		it('join', async () => {
			const res = await exe(`
			let arr = ["a", "b", "c"]
			<: arr.join("-")
			`);
			eq(res, STR('a-b-c'));
		});

		it('map', async () => {
			const res = await exe(`
			let arr = [1, 2, 3]
			<: arr.map(@(item) { item * 2 })
			`);
			eq(res, ARR([NUM(2), NUM(4), NUM(6)]));
		});

		it('filter', async () => {
			const res = await exe(`
			let arr = [1, 2, 3]
			<: arr.filter(@(item) { item != 2 })
			`);
			eq(res, ARR([NUM(1), NUM(3)]));
		});

		it('reduce', async () => {
			const res = await exe(`
			let arr = [1, 2, 3, 4]
			<: arr.reduce(@(accumulator, currentValue) { (accumulator + currentValue) })
			`);
			eq(res, NUM(10));
		});

		it('find', async () => {
			const res = await exe(`
			let arr = ["abc", "def", "ghi"]
			<: arr.find(@(item) { item.incl("e") })
			`);
			eq(res, STR('def'));
		});

		it('incl', async () => {
			const res = await exe(`
			let arr = ["abc", "def", "ghi"]
			<: [arr.incl("def"), arr.incl("jkl")]
			`);
			eq(res, ARR([TRUE, FALSE]));
		});

		it('reverse', async () => {
			const res = await exe(`
			let arr = [1, 2, 3]
			arr.reverse()
			<: arr
			`);
			eq(res, ARR([NUM(3), NUM(2), NUM(1)]));
		});

		it('copy', async () => {
			const res = await exe(`
			let arr = [1, 2, 3]
			let copied = arr.copy()
			copied.reverse()
			<: [copied, arr]
			`);
			eq(res, ARR([
				ARR([NUM(3), NUM(2), NUM(1)]),
				ARR([NUM(1), NUM(2), NUM(3)])
			]));
		});
	});
});

describe('std', () => {
	describe('Core', () => {
		it('range', async () => {
			eq(await exe('<: Core:range(1, 10)'), ARR([NUM(1), NUM(2), NUM(3), NUM(4), NUM(5), NUM(6), NUM(7), NUM(8), NUM(9), NUM(10)]));
			eq(await exe('<: Core:range(1, 1)'), ARR([NUM(1)]));
			eq(await exe('<: Core:range(9, 7)'), ARR([NUM(9), NUM(8), NUM(7)]));
		});
	});

	describe('Arr', () => {
	});

	describe('Obj', () => {
		it('keys', async () => {
			const res = await exe(`
			let o = { a: 1; b: 2; c: 3; }

			<: Obj:keys(o)
			`);
			eq(res, ARR([STR('a'), STR('b'), STR('c')]));
		});

		it('kvs', async () => {
			const res = await exe(`
			let o = { a: 1; b: 2; c: 3; }

			<: Obj:kvs(o)
			`);
			eq(res, ARR([
				ARR([STR('a'), NUM(1)]),
				ARR([STR('b'), NUM(2)]),
				ARR([STR('c'), NUM(3)])
			]));
		});
	});

	describe('Str', () => {
		it('lf', async () => {
			const res = await exe(`
			<: Str:lf
			`);
			eq(res, STR('\n'));
		});
	});
});

describe('Unicode', () => {
	it('len', async () => {
		const res = await exe(`
		<: "👍🏽🍆🌮".len
		`);
		eq(res, NUM(3));
	});

	it('pick', async () => {
		const res = await exe(`
		<: "👍🏽🍆🌮".pick(1)
		`);
		eq(res, STR('🍆'));
	});

	it('slice', async () => {
		const res = await exe(`
		<: "Emojis 👍🏽 are 🍆 poison. 🌮s are bad.".slice(7, 14)
		`);
		eq(res, STR('👍🏽 are 🍆'));
	});

	it('split', async () => {
		const res = await exe(`
		<: "👍🏽🍆🌮".split()
		`);
		eq(res, ARR([STR('👍🏽'), STR('🍆'), STR('🌮')]));
	});
});

describe('Security', () => {
	it('Cannot access js native property via var', async () => {
		try {
			await exe(`
			<: constructor
			`);
			assert.fail();
		} catch (e) {
			assert.equal(e instanceof errors.RuntimeError, true);
		}

		try {
			await exe(`
			<: prototype
			`);
			assert.fail();
		} catch (e) {
			assert.equal(e instanceof errors.RuntimeError, true);
		}

		try {
			await exe(`
			<: __proto__
			`);
			assert.fail();
		} catch (e) {
			assert.equal(e instanceof errors.RuntimeError, true);
		}
	});

	it('Cannot access js native property via object', async () => {
		const res1 = await exe(`
		let obj = {}

		<: obj.constructor
		`);
		eq(res1, NULL);

		const res2 = await exe(`
		let obj = {}

		<: obj.prototype
		`);
		eq(res2, NULL);

		const res3 = await exe(`
		let obj = {}

		<: obj.__proto__
		`);
		eq(res3, NULL);
	});

	it('Cannot access js native property via primitive prop', async () => {
		try {
			await exe(`
			<: "".constructor
			`);
			assert.fail();
		} catch (e) {
			assert.equal(e instanceof errors.RuntimeError, true);
		}

		try {
			await exe(`
			<: "".prototype
			`);
			assert.fail();
		} catch (e) {
			assert.equal(e instanceof errors.RuntimeError, true);
		}

		try {
			await exe(`
			<: "".__proto__
			`);
			assert.fail();
		} catch (e) {
			assert.equal(e instanceof errors.RuntimeError, true);
		}
	});
});

describe('extra', () => {
	it('Fizz Buzz', async () => {
		const res = await exe(`
		let res = []
		for (let i, 15) {
			let msg =
				if (i % 15 == 0) "FizzBuzz"
				elif (i % 3 == 0) "Fizz"
				elif (i % 5 == 0) "Buzz"
				else i
			res.push(msg)
		}
		<: res
		`);
		eq(res, ARR([
			NUM(1),
			NUM(2),
			STR('Fizz'),
			NUM(4),
			STR('Buzz'),
			STR('Fizz'),
			NUM(7),
			NUM(8),
			STR('Fizz'),
			STR('Buzz'),
			NUM(11),
			STR('Fizz'),
			NUM(13),
			NUM(14),
			STR('FizzBuzz'),
		]));
	});

	it('SKI', async () => {
		const res = await exe(`
		let s = @(x) { @(y) { @(z) {
			//let f = x(z) f(@(a){ let g = y(z) g(a) })
			let f = x(z)
			f(y(z))
		}}}
		let k = @(x){ @(y) { x } }
		let i = @(x){ x }

		// combine
		@c(l) {
			// extract
			@x(v) {
				if (Core:type(v) == "arr") { c(v) } else { v }
			}

			// rec
			@r(f, n) {
				if (n < l.len) {
					r(f(x(l[n])), (n + 1))
				} else { f }
			}

			r(x(l[0]), 1)
		}

		let sksik = [s, [k, [s, i]], k]
		c([sksik, "foo", print])
		`);
		eq(res, STR('foo'));
	});
});
