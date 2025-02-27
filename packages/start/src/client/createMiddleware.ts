import type { ConstrainValidator, Method } from './createServerFn'
import type {
  Assign,
  Constrain,
  DefaultTransformerStringify,
  Expand,
  ResolveValidatorInput,
  ResolveValidatorOutput,
} from '@tanstack/react-router'

export type MergeAllMiddleware<
  TMiddlewares,
  TType extends keyof AnyMiddleware['_types'],
  TAcc = undefined,
> = TMiddlewares extends readonly [
  infer TMiddleware extends AnyMiddleware,
  ...infer TRest,
]
  ? MergeAllMiddleware<TRest, TType, Assign<TAcc, TMiddleware['_types'][TType]>>
  : TAcc

export type MergeAllClientAfterContext<
  TMiddlewares,
  TClientContext = undefined,
  TClientAfterContext = undefined,
> = unknown extends TClientContext
  ? TClientContext
  : Assign<
      MergeAllMiddleware<TMiddlewares, 'allClientAfterContext'>,
      Assign<TClientContext, TClientAfterContext>
    >

/**
 * Recursively resolve the client context type produced by a sequence of middleware
 */
export type MergeAllClientContext<
  TMiddlewares,
  TContext = undefined,
> = unknown extends TContext
  ? TContext
  : Assign<MergeAllMiddleware<TMiddlewares, 'allClientContext'>, TContext>

/**
 * Recursively resolve the server context type produced by a sequence of middleware
 */
export type MergeAllServerContext<
  TMiddlewares,
  TContext = undefined,
> = unknown extends TContext
  ? TContext
  : Assign<MergeAllMiddleware<TMiddlewares, 'allServerContext'>, TContext>

/**
 * Recursively resolve the input type produced by a sequence of middleware
 */
export type MergeAllValidatorInputs<TMiddlewares, TValidator> =
  unknown extends TValidator
    ? TValidator
    : Assign<
        MergeAllMiddleware<TMiddlewares, 'allInput'>,
        TValidator extends undefined
          ? undefined
          : ResolveValidatorInput<TValidator>
      >
/**
 * Recursively merge the output type produced by a sequence of middleware
 */
export type MergeAllValidatorOutputs<TMiddlewares, TValidator> =
  unknown extends TValidator
    ? TValidator
    : Assign<
        MergeAllMiddleware<TMiddlewares, 'allOutput'>,
        TValidator extends undefined
          ? undefined
          : ResolveValidatorOutput<TValidator>
      >

export interface MiddlewareOptions<
  in out TMiddlewares,
  in out TValidator,
  in out TServerContext,
  in out TClientContext,
> {
  validateClient?: boolean
  middleware?: TMiddlewares
  validator?: ConstrainValidator<TValidator>
  client?: MiddlewareClientFn<
    TMiddlewares,
    TValidator,
    TServerContext,
    TClientContext
  >
  server?: MiddlewareServerFn<
    TMiddlewares,
    TValidator,
    TServerContext,
    unknown,
    unknown
  >
  clientAfter?: MiddlewareClientAfterFn<
    TMiddlewares,
    TValidator,
    TClientContext,
    unknown,
    unknown
  >
}

export type MiddlewareServerNextFn = <
  TNewServerContext = undefined,
  TNewClientAfterContext = undefined,
>(ctx?: {
  context?: TNewServerContext
  sendContext?: DefaultTransformerStringify<TNewClientAfterContext>
}) => Promise<
  ServerResultWithContext<TNewServerContext, TNewClientAfterContext>
>

export interface MiddlewareServerFnOptions<
  in out TMiddlewares,
  in out TValidator,
  in out TServerContext,
> {
  data: Expand<MergeAllValidatorOutputs<TMiddlewares, TValidator>>
  context: Expand<MergeAllServerContext<TMiddlewares, TServerContext>>
  next: MiddlewareServerNextFn
  method: Method
  filename: string
  functionId: string
}

export type MiddlewareServerFn<
  TMiddlewares,
  TValidator,
  TServerContext,
  TNewServerContext,
  TNewClientAfterContext,
> = (
  options: MiddlewareServerFnOptions<TMiddlewares, TValidator, TServerContext>,
) => MiddlewareServerFnResult<TNewServerContext, TNewClientAfterContext>

export type MiddlewareServerFnResult<TServerContext, TClientAfterContext> =
  | Promise<ServerResultWithContext<TServerContext, TClientAfterContext>>
  | ServerResultWithContext<TServerContext, TClientAfterContext>

export type MiddlewareClientNextFn = <
  TNewServerContext = undefined,
  TNewClientContext = undefined,
>(ctx?: {
  context?: TNewClientContext
  sendContext?: DefaultTransformerStringify<TNewServerContext>
  headers?: HeadersInit
}) => Promise<ClientResultWithContext<TNewServerContext, TNewClientContext>>

export interface MiddlewareClientFnOptions<
  in out TMiddlewares,
  in out TValidator,
> {
  data: Expand<MergeAllValidatorInputs<TMiddlewares, TValidator>>
  context: Expand<MergeAllClientContext<TMiddlewares>>
  sendContext?: unknown // cc Chris Horobin
  method: Method
  next: MiddlewareClientNextFn
  filename: string
  functionId: string
}

export type MiddlewareClientFn<
  TMiddlewares,
  TValidator,
  TServerContext,
  TClientContext,
> = (
  options: MiddlewareClientFnOptions<TMiddlewares, TValidator>,
) => MiddlewareClientFnResult<TServerContext, TClientContext>

export type MiddlewareClientFnResult<TServerContext, TClientContext> =
  | Promise<ClientResultWithContext<TServerContext, TClientContext>>
  | ClientResultWithContext<TServerContext, TClientContext>

export type MiddlewareClientAfterNextFn = <
  TNewClientAfterContext = undefined,
>(ctx?: {
  context?: TNewClientAfterContext
  sendContext?: never
  headers?: HeadersInit
}) => Promise<ClientAfterResultWithContext<TNewClientAfterContext>>

export interface MiddlewareClientAfterFnOptions<
  in out TMiddlewares,
  in out TValidator,
  in out TClientContext,
  in out TClientAfterContext,
> {
  data: Expand<MergeAllValidatorInputs<TMiddlewares, TValidator>>
  context: Expand<
    MergeAllClientAfterContext<
      TMiddlewares,
      TClientContext,
      TClientAfterContext
    >
  >
  method: Method
  next: MiddlewareClientAfterNextFn
}

export type MiddlewareClientAfterFn<
  TMiddlewares,
  TValidator,
  TClientContext,
  TClientAfterContext,
  TNewClientAfterContext,
> = (
  options: MiddlewareClientAfterFnOptions<
    TMiddlewares,
    TValidator,
    TClientContext,
    TClientAfterContext
  >,
) => MiddlewareClientAfterFnResult<TNewClientAfterContext>

export type MiddlewareClientAfterFnResult<TNewClientAfterContext> =
  | Promise<ClientAfterResultWithContext<TNewClientAfterContext>>
  | ClientAfterResultWithContext<TNewClientAfterContext>

export type ServerResultWithContext<TContext, TClientAfterContext> = {
  'use functions must return the result of next()': true
  context: TContext
  clientAfterContext: TClientAfterContext
}

export type ClientAfterResultWithContext<TClientContext> = {
  'use functions must return the result of next()': true
  context: TClientContext
  headers: HeadersInit
}

export type ClientResultWithContext<TServerContext, TClientContext> = {
  'use functions must return the result of next()': true
  context: TClientContext
  serverContext: TServerContext
  headers: HeadersInit
}

export type AnyMiddleware = MiddlewareTypes<any, any, any, any, any>

export interface MiddlewareTypes<
  TMiddlewares,
  TValidator,
  TServerContext,
  TClientContext,
  TClientAfterContext,
> {
  _types: {
    middlewares: TMiddlewares
    input: ResolveValidatorInput<TValidator>
    allInput: MergeAllValidatorInputs<TMiddlewares, TValidator>
    output: ResolveValidatorOutput<TValidator>
    allOutput: MergeAllValidatorOutputs<TMiddlewares, TValidator>
    clientContext: TClientContext
    allClientContext: MergeAllClientContext<TMiddlewares, TClientContext>
    serverContext: TServerContext
    allServerContext: MergeAllServerContext<TMiddlewares, TServerContext>
    clientAfterContext: TClientAfterContext
    allClientAfterContext: MergeAllClientAfterContext<
      TMiddlewares,
      TClientContext,
      TClientAfterContext
    >
    validator: TValidator
  }
  options: MiddlewareOptions<
    TMiddlewares,
    TValidator,
    TServerContext,
    TClientContext
  >
}

export interface MiddlewareAfterValidator<TMiddlewares, TValidator>
  extends MiddlewareTypes<
      TMiddlewares,
      TValidator,
      undefined,
      undefined,
      undefined
    >,
    MiddlewareServer<TMiddlewares, TValidator, undefined, undefined>,
    MiddlewareClient<TMiddlewares, TValidator> {}

export interface MiddlewareValidator<TMiddlewares> {
  validator: <TNewValidator>(
    input: ConstrainValidator<TNewValidator>,
  ) => MiddlewareAfterValidator<TMiddlewares, TNewValidator>
}

export interface MiddlewareClientAfter<
  TMiddlewares,
  TValidator,
  TServerContext,
  TClientContext,
  TClientAfterContext,
> {
  clientAfter: <TNewClientAfterContext = undefined>(
    clientAfter: MiddlewareClientAfterFn<
      TMiddlewares,
      TValidator,
      TClientContext,
      TClientAfterContext,
      TNewClientAfterContext
    >,
  ) => MiddlewareAfterServer<
    TMiddlewares,
    TValidator,
    TServerContext,
    TClientContext,
    Assign<TClientAfterContext, TNewClientAfterContext>
  >
}

export interface MiddlewareAfterServer<
  TMiddlewares,
  TValidator,
  TServerContext,
  TClientContext,
  TClientAfterContext,
> extends MiddlewareTypes<
      TMiddlewares,
      TValidator,
      TServerContext,
      TClientContext,
      TClientAfterContext
    >,
    MiddlewareClientAfter<
      TMiddlewares,
      TValidator,
      TServerContext,
      TClientContext,
      TClientAfterContext
    > {}

export interface MiddlewareServer<
  TMiddlewares,
  TValidator,
  TServerContext,
  TClientContext,
> {
  server: <TNewServerContext = undefined, TNewClientAfterContext = undefined>(
    server: MiddlewareServerFn<
      TMiddlewares,
      TValidator,
      TServerContext,
      TNewServerContext,
      TNewClientAfterContext
    >,
  ) => MiddlewareAfterServer<
    TMiddlewares,
    TValidator,
    Assign<TServerContext, TNewServerContext>,
    TClientContext,
    TNewClientAfterContext
  >
}

export interface MiddlewareAfterClient<
  TMiddlewares,
  TValidator,
  TServerContext,
  TClientContext,
> extends MiddlewareTypes<
      TMiddlewares,
      TValidator,
      TServerContext,
      TClientContext,
      undefined
    >,
    MiddlewareServer<
      TMiddlewares,
      TValidator,
      TServerContext,
      TClientContext
    > {}

export interface MiddlewareClient<TMiddlewares, TValidator> {
  client: <TNewServerContext = undefined, TNewClientContext = undefined>(
    client: MiddlewareClientFn<
      TMiddlewares,
      TValidator,
      TNewServerContext,
      TNewClientContext
    >,
  ) => MiddlewareAfterClient<
    TMiddlewares,
    TValidator,
    TNewServerContext,
    TNewClientContext
  >
}

export interface MiddlewareAfterMiddleware<TMiddlewares>
  extends MiddlewareTypes<
      TMiddlewares,
      undefined,
      undefined,
      undefined,
      undefined
    >,
    MiddlewareServer<TMiddlewares, undefined, undefined, undefined>,
    MiddlewareClient<TMiddlewares, undefined>,
    MiddlewareValidator<TMiddlewares> {}

export interface Middleware extends MiddlewareAfterMiddleware<unknown> {
  middleware: <const TNewMiddlewares = undefined>(
    middlewares: Constrain<TNewMiddlewares, ReadonlyArray<AnyMiddleware>>,
  ) => MiddlewareAfterMiddleware<TNewMiddlewares>
}

export function createMiddleware(
  options?: {
    validateClient?: boolean
  },
  __opts?: MiddlewareOptions<unknown, undefined, undefined, undefined>,
): Middleware {
  // const resolvedOptions = (__opts || options) as MiddlewareOptions<
  const resolvedOptions =
    __opts ||
    ((options || {}) as MiddlewareOptions<
      unknown,
      undefined,
      undefined,
      undefined
    >)

  return {
    options: resolvedOptions as any,
    middleware: (middleware: any) => {
      return createMiddleware(
        undefined,
        Object.assign(resolvedOptions, { middleware }),
      ) as any
    },
    validator: (validator: any) => {
      return createMiddleware(
        undefined,
        Object.assign(resolvedOptions, { validator }),
      ) as any
    },
    client: (client: any) => {
      return createMiddleware(
        undefined,
        Object.assign(resolvedOptions, { client }),
      ) as any
    },
    server: (server: any) => {
      return createMiddleware(
        undefined,
        Object.assign(resolvedOptions, { server }),
      ) as any
    },
    clientAfter: (clientAfter: any) => {
      return createMiddleware(
        undefined,
        Object.assign(resolvedOptions, { clientAfter }),
      ) as any
    },
  } as unknown as Middleware
}
