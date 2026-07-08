import { beforeEach, expect, it } from 'bun:test'

import { Container } from './container'
import { Inject } from './inject'
import { createToken } from './token'

let container: Container

beforeEach(() => {
  container = new Container()
})

it('should call onModuleInit synchronously', () => {
  const TOKEN = createToken()
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
  const TOKEN = createToken()
  let called = false

  class Class {
    async onModuleInit() {
      await Promise.resolve()
      called = true
    }
  }

  container.registerClass(TOKEN, Class)
  await container.resolveAsync(TOKEN)

  expect(called).toBe(true)
})

it('should return same pointer for value provider', () => {
  const TOKEN = createToken()
  const value = { PORT: 5000 }

  container.registerValue(TOKEN, value)

  expect(container.resolve(TOKEN)).toBe(container.resolve(TOKEN))
  expect(container.resolve(TOKEN)).toBe(value)
})

it('should resolve class', () => {
  const TOKEN = createToken()
  class Class {}

  container.registerClass(TOKEN, Class)

  expect(container.resolve(TOKEN)).toBeInstanceOf(Class)
})

it('should be singleton', () => {
  const TOKEN = createToken<Class>()
  class Class {}

  container.registerClass(TOKEN, Class)

  expect(container.resolve(TOKEN)).toBe(container.resolve(TOKEN))
})

it('should be transient', () => {
  const TOKEN = createToken<Class>()
  class Class {}

  container.registerClass(TOKEN, Class, 'transient')

  expect(container.resolve(TOKEN)).not.toBe(container.resolve(TOKEN))
})

it('should resolve singleton factory', () => {
  const TOKEN = createToken<{ id: number }>()
  let calls = 0

  container.register({
    provide: TOKEN,
    useFactory: () => {
      calls += 1
      return { id: calls }
    },
  })

  expect(container.resolve(TOKEN)).toBe(container.resolve(TOKEN))
  expect(calls).toBe(1)
})

it('should resolve transient factory', () => {
  const TOKEN = createToken<{ id: number }>()
  let calls = 0

  container.register({
    provide: TOKEN,
    useFactory: () => ({ id: ++calls }),
    scope: 'transient',
  })

  expect(container.resolve(TOKEN)).not.toBe(container.resolve(TOKEN))
  expect(calls).toBe(2)
})

it('should respect dependencies order', () => {
  const TOKEN1 = createToken<Class1>()
  class Class1 {}

  const TOKEN2 = createToken<Class2>()
  class Class2 {}

  const TOKEN3 = createToken<Class3>()

  @Inject(TOKEN1, TOKEN2)
  class Class3 {
    constructor(
      public class1: Class1,
      public class2: Class2,
    ) {}
  }

  container.registerClass(TOKEN1, Class1)
  container.registerClass(TOKEN2, Class2)
  container.registerClass(TOKEN3, Class3)

  const class3 = container.resolve(TOKEN3)

  expect(class3).toBeDefined()
  expect(class3.class1).toBeInstanceOf(Class1)
  expect(class3.class2).toBeInstanceOf(Class2)
})

it('should resolve nested dependencies', () => {
  const TOKEN1 = createToken<Class1>()
  class Class1 {}

  const TOKEN2 = createToken<Class2>()
  @Inject(TOKEN1)
  class Class2 {
    constructor(public class1: Class1) {}
  }

  const TOKEN3 = createToken<Class3>()
  @Inject(TOKEN2)
  class Class3 {
    constructor(public class2: Class2) {}
  }

  container.registerClass(TOKEN1, Class1)
  container.registerClass(TOKEN2, Class2)
  container.registerClass(TOKEN3, Class3)

  const class3 = container.resolve(TOKEN3)

  expect(class3.class2).toBeInstanceOf(Class2)
  expect(class3.class2.class1).toBeInstanceOf(Class1)
})

it('should reuse singleton dependency inside transient provider', () => {
  const TOKEN1 = createToken<Class1>()
  class Class1 {}

  const TOKEN2 = createToken<Class2>()
  @Inject(TOKEN1)
  class Class2 {
    constructor(public class1: Class1) {}
  }

  container.registerClass(TOKEN1, Class1)
  container.registerClass(TOKEN2, Class2, 'transient')

  const class2a = container.resolve(TOKEN2)
  const class2b = container.resolve(TOKEN2)

  expect(class2a).not.toBe(class2b)
  expect(class2a.class1).toBe(class2b.class1)
})

it('should create transient dependency once for singleton provider', () => {
  const TOKEN1 = createToken<Class1>()
  class Class1 {}

  const TOKEN2 = createToken<Class2>()
  @Inject(TOKEN1)
  class Class2 {
    constructor(public class1: Class1) {}
  }

  container.registerClass(TOKEN1, Class1, 'transient')
  container.registerClass(TOKEN2, Class2)

  const class2a = container.resolve(TOKEN2)
  const class2b = container.resolve(TOKEN2)

  expect(class2a).toBe(class2b)
  expect(class2a.class1).toBe(class2b.class1)
})

it('should throw on missing provider or dependency', () => {
  const TOKEN1 = createToken<Class1>()
  class Class1 {}

  const TOKEN2 = createToken<Class2>()
  @Inject(TOKEN1)
  class Class2 {
    constructor(public class1: Class1) {}
  }

  container.registerClass(TOKEN2, Class2)

  expect(() => container.resolve(createToken('Not-Found'))).toThrow(Error)
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

it('should provide correct resolution context', () => {
  const LOGGER = createToken<string>('Logger')
  const INNER = createToken<any>('Inner')
  const OUTER = createToken<any>('Outer')
  const ALT = createToken<any>('Alt')

  let parentName: string | undefined
  let rootName: string | undefined
  let stackTokens: string[] = []

  @Inject(LOGGER)
  class Inner {
    constructor(public logger: string) {}
  }

  @Inject(INNER)
  class Outer {
    constructor(public inner: Inner) {}
  }

  @Inject(LOGGER)
  class Alt {
    constructor(public logger: string) {}
  }

  container.register({
    provide: LOGGER,
    scope: 'transient',
    useFactory: (_, ctx) => {
      parentName = ctx.parent?.useClass?.name
      rootName = ctx.root?.useClass?.name
      stackTokens = ctx.stack.map((f) => String(f.token))
      return ctx.parent?.useClass?.name ?? 'no-parent'
    },
  })

  container.registerClass(INNER, Inner)
  container.registerClass(OUTER, Outer)
  container.registerClass(ALT, Alt)

  const outer = container.resolve(OUTER)

  expect(outer.inner.logger).toBe('Inner')
  expect(parentName).toBe('Inner')
  expect(rootName).toBe('Outer')
  expect(stackTokens).toEqual(['Symbol(Outer)', 'Symbol(Inner)', 'Symbol(Logger)'])

  const alt = container.resolve(ALT)

  expect(alt.logger).toBe('Alt')
  expect(parentName).toBe('Alt')
  expect(rootName).toBe('Alt')
  expect(stackTokens).toEqual(['Symbol(Alt)', 'Symbol(Logger)'])
})

it('should have no parent or root when factory is resolved at top level', () => {
  const TOKEN = createToken<string>('TopLevel')
  let hasParent = true
  let rootToken: symbol | undefined
  let stackLength = 0

  container.register({
    provide: TOKEN,
    scope: 'transient',
    useFactory: (_, ctx) => {
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

it('should resolve async factory', async () => {
  const TOKEN = createToken<string>()

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
