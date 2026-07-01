import { beforeEach, expect, it } from 'vitest'

import { Container, Inject, createToken } from '../src'

let container: Container

beforeEach(() => {
  container = new Container()
})

it('should call onModuleInit synchronously', () => {
  const TOKEN = createToken('token')
  let called = false

  class Class {
    onModuleInit() {
      called = true
    }
  }

  container.registerClass(TOKEN, Class)
  container.resolve(TOKEN)

  expect(called).toBe(true)
})

it('should call onModuleInit asynchronously', async () => {
  const TOKEN = createToken('token')
  let called = false

  class Class {
    async onModuleInit() {
      await new Promise((resolve) => setTimeout(resolve, 10))
      called = true
    }
  }

  container.registerClass(TOKEN, Class)
  await container.resolveAsync(TOKEN)

  expect(called).toBe(true)
})

it('should return same value for value provider', () => {
  const TOKEN = createToken('token')
  const value = { PORT: 5000 }

  container.registerValue(TOKEN, value)

  expect(container.resolve(TOKEN)).toBe(container.resolve(TOKEN))
  expect(container.resolve(TOKEN)).toBe(value)
})

it('should return correct instance for class provider', () => {
  const TOKEN = createToken('token')
  class Class {}

  container.registerClass(TOKEN, Class)

  expect(container.resolve(TOKEN)).toBeInstanceOf(Class)
})

it('should be singleton', () => {
  const TOKEN = createToken<Class>('token')
  class Class {}

  container.registerClass(TOKEN, Class)

  expect(container.resolve(TOKEN)).toBe(container.resolve(TOKEN))
})

it('should be transient', () => {
  const TOKEN = createToken<Class>('token')
  class Class {}

  container.registerClass(TOKEN, Class, 'transient')

  expect(container.resolve(TOKEN)).not.toBe(container.resolve(TOKEN))
})

it('should register class provider objects', () => {
  const TOKEN = createToken<Class>('token')
  class Class {}

  container.register({
    provide: TOKEN,
    useClass: Class,
  })

  expect(container.resolve(TOKEN)).toBeInstanceOf(Class)
})

it('should resolve singleton factory providers once', () => {
  const TOKEN = createToken<{ id: number }>('token')
  let calls = 0

  container.register({
    provide: TOKEN,
    useFactory: (_c, _ctx) => {
      calls += 1

      return { id: calls }
    },
  })

  expect(container.resolve(TOKEN)).toBe(container.resolve(TOKEN))
  expect(calls).toBe(1)
})

it('should resolve transient factory providers each time', () => {
  const TOKEN = createToken<{ id: number }>('token')
  let calls = 0

  container.register({
    provide: TOKEN,
    useFactory: (_c, _ctx) => ({ id: ++calls }),
    scope: 'transient',
  })

  expect(container.resolve(TOKEN)).not.toBe(container.resolve(TOKEN))
  expect(calls).toBe(2)
})

it('should resolve class without inject decorator', () => {
  const TOKEN = createToken('token')
  class Class {}

  container.registerClass(TOKEN, Class)

  expect(container.resolve(TOKEN)).toBeInstanceOf(Class)
})

it('should resolve dependencies in correct order', () => {
  const TOKEN1 = createToken<Class1>('token')
  class Class1 {}

  const TOKEN2 = createToken<Class2>('token')
  class Class2 {}

  const TOKEN3 = createToken<Class3>('token')
  @Inject(TOKEN1, TOKEN2)
  class Class3 {
    class2: Class2
    class1: Class1
    constructor(class1: Class1, class2: Class2) {
      this.class1 = class1
      this.class2 = class2
    }
  }

  container.registerClass(TOKEN1, Class1)
  container.registerClass(TOKEN2, Class2)
  container.registerClass(TOKEN3, Class3)

  const class3 = container.resolve(TOKEN3)

  expect(class3).toBeDefined()
  expect(class3.class1).toBeDefined()
  expect(class3.class2).toBeDefined()

  expect(class3).toBeInstanceOf(Class3)
  expect(class3.class1).toBeInstanceOf(Class1)
  expect(class3.class2).toBeInstanceOf(Class2)
})

it('should resolve recursive dependencies', () => {
  const TOKEN1 = createToken<Class1>('token')
  class Class1 {}

  const TOKEN2 = createToken<Class2>('token')
  @Inject(TOKEN1)
  class Class2 {
    class1: Class1
    constructor(class1: Class1) {
      this.class1 = class1
    }
  }

  const TOKEN3 = createToken<Class3>('token')
  @Inject(TOKEN2)
  class Class3 {
    class2: Class2
    constructor(class2: Class2) {
      this.class2 = class2
    }
  }

  container.registerClass(TOKEN1, Class1)
  container.registerClass(TOKEN2, Class2)
  container.registerClass(TOKEN3, Class3)

  const class3 = container.resolve(TOKEN3)

  expect(class3).toBeDefined()
  expect(class3.class2).toBeDefined()
  expect(class3.class2.class1).toBeDefined()

  expect(class3).toBeInstanceOf(Class3)
  expect(class3.class2).toBeInstanceOf(Class2)
  expect(class3.class2.class1).toBeInstanceOf(Class1)
})

it('should reuse singleton dependency inside transient provider', () => {
  const TOKEN1 = createToken<Class1>('token')
  class Class1 {}

  const TOKEN2 = createToken<Class2>('token')
  @Inject(TOKEN1)
  class Class2 {
    class1: Class1
    constructor(class1: Class1) {
      this.class1 = class1
    }
  }

  container.registerClass(TOKEN1, Class1)
  container.registerClass(TOKEN2, Class2, 'transient')

  const class2a = container.resolve(TOKEN2)
  const class2b = container.resolve(TOKEN2)

  expect(class2a).not.toBe(class2b)
  expect(class2a.class1).toBe(class2b.class1)
})

it('should create transient dependency once for singleton provider', () => {
  const TOKEN1 = createToken<Class1>('token')
  class Class1 {}

  const TOKEN2 = createToken<Class2>('token')
  @Inject(TOKEN1)
  class Class2 {
    class1: Class1
    constructor(class1: Class1) {
      this.class1 = class1
    }
  }

  container.registerClass(TOKEN1, Class1, 'transient')
  container.registerClass(TOKEN2, Class2)

  const class2a = container.resolve(TOKEN2)
  const class2b = container.resolve(TOKEN2)

  expect(class2a).toBe(class2b)
  expect(class2a.class1).toBe(class2b.class1)
})

it('should throw on invalid token', () => {
  const TOKEN = createToken<Class>('token')
  class Class {}

  expect(() => container.resolve(TOKEN)).toThrow(Error)
})

it('should throw invalid recursive token', () => {
  const TOKEN1 = createToken<Class1>('token')
  class Class1 {}

  const TOKEN2 = createToken<Class2>('token')
  @Inject(TOKEN1)
  class Class2 {
    class1: Class1
    constructor(class1: Class1) {
      this.class1 = class1
    }
  }

  container.registerClass(TOKEN2, Class2)

  expect(() => container.resolve(TOKEN2)).toThrow(Error)
})

it('should throw on circular dependency', () => {
  const TOKEN_A = createToken('token-a')
  const TOKEN_B = createToken('token-b')

  @Inject(TOKEN_B)
  class ClassA {
    constructor(public b: any) {}
  }

  @Inject(TOKEN_A)
  class ClassB {
    constructor(public a: any) {}
  }

  container.registerClass(TOKEN_A, ClassA)
  container.registerClass(TOKEN_B, ClassB)

  expect(() => container.resolve(TOKEN_A)).toThrow(/Circular dependency Symbol\(token-a\)/)
})

it('should throw on self-circular dependency (A -> A)', () => {
  const TOKEN_A = createToken('token-a')

  @Inject(TOKEN_A)
  class ClassA {
    constructor(public a: any) {}
  }

  container.registerClass(TOKEN_A, ClassA)

  expect(() => container.resolve(TOKEN_A)).toThrow(/Circular dependency Symbol\(token-a\)/)
})

it('should clean up resolution stack after failure', () => {
  const TOKEN_A = createToken('token-a')
  const TOKEN_FAIL = createToken('token-fail')

  @Inject(TOKEN_FAIL)
  class ClassA {
    constructor(public f: any) {}
  }

  container.registerClass(TOKEN_A, ClassA)

  expect(() => container.resolve(TOKEN_A)).toThrow(/No provider for Symbol\(token-fail\)/)

  class ClassFail {}
  container.registerClass(TOKEN_FAIL, ClassFail)

  expect(() => container.resolve(TOKEN_A)).not.toThrow()
})

it('should pass different parent context per consumer', () => {
  const LOGGER = createToken<string>('Logger')
  const A_TOKEN = createToken<any>('A')
  const B_TOKEN = createToken<any>('B')

  @Inject(LOGGER)
  class ClassA {
    constructor(public logger: string) {}
  }

  @Inject(LOGGER)
  class ClassB {
    constructor(public logger: string) {}
  }

  container.register({
    provide: LOGGER,
    scope: 'transient',
    useFactory: (_c, ctx) => ctx.parent?.useClass?.name ?? 'unknown',
  })

  container.registerClass(A_TOKEN, ClassA)
  container.registerClass(B_TOKEN, ClassB)

  expect(container.resolve(A_TOKEN).logger).toBe('ClassA')
  expect(container.resolve(B_TOKEN).logger).toBe('ClassB')
})

it('should provide root as the first frame in the chain', () => {
  const LOGGER = createToken<string>('Logger')
  const INNER = createToken<any>('Inner')
  const OUTER = createToken<any>('Outer')

  let parentName: string | undefined
  let rootName: string | undefined
  let stackLength = 0

  @Inject(LOGGER)
  class Inner {
    constructor(public logger: string) {}
  }

  @Inject(INNER)
  class Outer {
    constructor(public inner: Inner) {}
  }

  container.register({
    provide: LOGGER,
    scope: 'transient',
    useFactory: (_c, ctx) => {
      parentName = ctx.parent?.useClass?.name
      rootName = ctx.root?.useClass?.name
      stackLength = ctx.stack.length
      return ctx.root?.useClass?.name ?? 'no-root'
    },
  })

  container.registerClass(INNER, Inner)
  container.registerClass(OUTER, Outer)

  const outer = container.resolve(OUTER)

  expect(outer.inner.logger).toBe('Outer')
  expect(parentName).toBe('Inner')
  expect(rootName).toBe('Outer')
  expect(stackLength).toBe(3)
})

it('should have no parent or root when factory is resolved at top level', () => {
  const TOKEN = createToken<string>('TopLevel')
  let hasParent = true
  let rootToken: symbol | undefined
  let stackLength = 0

  container.register({
    provide: TOKEN,
    scope: 'transient',
    useFactory: (_c, ctx) => {
      hasParent = ctx.parent !== undefined
      rootToken = ctx.root?.token as symbol | undefined
      stackLength = ctx.stack.length
      return 'value'
    },
  })

  container.resolve(TOKEN)

  expect(hasParent).toBe(false)
  expect(rootToken).toBe(TOKEN)
  expect(stackLength).toBe(1)
})

it('should detect circular dependency through factory container.resolve()', () => {
  const TOKEN_A = createToken('A')
  const TOKEN_B = createToken('B')

  container.register({
    provide: TOKEN_A,
    useFactory: (c, _ctx) => c.resolve(TOKEN_B),
  })

  container.register({
    provide: TOKEN_B,
    useFactory: (c, _ctx) => c.resolve(TOKEN_A),
  })

  expect(() => container.resolve(TOKEN_A)).toThrow(/Circular dependency Symbol\(A\)/)
})

it('should pass stack as ReadonlyArray reflecting the resolution path', () => {
  const DEP = createToken<string>('Dep')
  const MID = createToken<any>('Mid')
  const TOP = createToken<any>('Top')

  let stackTokens: string[] = []

  @Inject(DEP)
  class Mid {
    constructor(public dep: string) {}
  }

  @Inject(MID)
  class Top {
    constructor(public mid: Mid) {}
  }

  container.register({
    provide: DEP,
    scope: 'transient',
    useFactory: (_c, ctx) => {
      stackTokens = ctx.stack.map((f) => String(f.token))
      return 'ok'
    },
  })

  container.registerClass(MID, Mid)
  container.registerClass(TOP, Top)

  container.resolve(TOP)

  expect(stackTokens).toEqual(['Symbol(Top)', 'Symbol(Mid)', 'Symbol(Dep)'])
})

it('should resolve async factory', async () => {
  const TOKEN = createToken<string>('token')

  container.register({
    provide: TOKEN,
    useFactory: async () => {
      return new Promise((resolve) => setTimeout(() => resolve('async value'), 10))
    },
  })

  const result = await container.resolveAsync(TOKEN)
  expect(result).toBe('async value')
})

it('should resolve class with async dependencies', async () => {
  const ASYNC_DEP = createToken<string>('async-dep')
  const CLASS = createToken<MyClass>('class')

  @Inject(ASYNC_DEP)
  class MyClass {
    constructor(public dep: string) {}
  }

  container.register({
    provide: ASYNC_DEP,
    useFactory: async () => 'resolved async',
  })
  container.registerClass(CLASS, MyClass)

  const instance = await container.resolveAsync(CLASS)
  expect(instance).toBeInstanceOf(MyClass)
  expect(instance.dep).toBe('resolved async')
})
