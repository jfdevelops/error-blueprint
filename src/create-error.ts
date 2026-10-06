import type { StandardSchemaV1 } from '@standard-schema/spec';

import type {
  BlueprintContext,
  BlueprintErrorTemplate,
  CreateErrorConfig,
  ErrorFamilyFactory,
} from './types.js';

type RuntimeImplementation = (argument: unknown) => string;

type ErrorConfigBody<
  Schema extends StandardSchemaV1,
  DataConfig extends CreateErrorConfig<Schema>['data'],
  MessageCallback extends CreateErrorConfig<Schema>['message'],
> = {
  data: DataConfig;
  message: MessageCallback;
};

type ErrorConfigWithProperties<
  Schema extends StandardSchemaV1,
  DataConfig extends CreateErrorConfig<Schema>['data'],
  MessageCallback extends CreateErrorConfig<Schema>['message'],
  Properties extends object,
> = ErrorConfigBody<Schema, DataConfig, MessageCallback> & {
  properties(context: BlueprintContext<Schema>): Properties;
};

type ErrorConfigWithoutProperties<
  Schema extends StandardSchemaV1,
  DataConfig extends CreateErrorConfig<Schema>['data'],
  MessageCallback extends CreateErrorConfig<Schema>['message'],
> = ErrorConfigBody<Schema, DataConfig, MessageCallback> & {
  properties?: never;
};

type ExactCreateErrorConfig<
  Schema extends StandardSchemaV1,
  Config extends object,
> = {
  definition: Schema;
} & Config &
  (StandardSchemaV1.InferOutput<Schema> extends object
    ? unknown
    : { definition: never });

type SerializedCreateErrorConfig<
  Schema extends StandardSchemaV1,
  Config extends object,
  Json,
> = ExactCreateErrorConfig<
  Schema,
  Config & {
    toJSON(error: BlueprintErrorTemplate<NoInfer<Config>>): Json;
  }
>;

const protectedPropertyNames = new Set([
  'name',
  'message',
  'stack',
  'cause',
  'constructor',
  'prototype',
]);

function isObjectLike(value: unknown): value is object {
  return (
    value !== null && (typeof value === 'object' || typeof value === 'function')
  );
}

function isPlainObject(value: unknown): value is Record<PropertyKey, unknown> {
  if (!isObjectLike(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function includeDefinition(
  argument: unknown,
  definition: object,
): unknown {
  if (!isPlainObject(argument)) {
    return argument;
  }

  return { ...definition, ...argument };
}

function validateStandardSchema(schema: unknown, subject: string) {
  if (!isObjectLike(schema)) {
    throw new TypeError(`${subject} must be a Standard Schema object`);
  }

  const standard = Reflect.get(schema, '~standard') as unknown;

  if (
    !isObjectLike(standard) ||
    Reflect.get(standard, 'version') !== 1 ||
    typeof Reflect.get(standard, 'vendor') !== 'string' ||
    typeof Reflect.get(standard, 'validate') !== 'function'
  ) {
    throw new TypeError(`${subject} must implement Standard Schema V1`);
  }
}

function validateBlueprint(config: CreateErrorConfig<StandardSchemaV1>) {
  validateStandardSchema(config.definition, 'definition');

  if (
    typeof config.data.property !== 'string' ||
    config.data.property.length === 0
  ) {
    throw new TypeError('data.property must be a non-empty string');
  }

  if (protectedPropertyNames.has(config.data.property)) {
    throw new TypeError(
      `data.property cannot overwrite protected property "${config.data.property}"`,
    );
  }
}

function formatIssuePath(path: StandardSchemaV1.Issue['path']) {
  if (!path?.length) {
    return '';
  }

  const keys = path.map((segment) =>
    typeof segment === 'object' ? segment.key : segment,
  );

  return `${keys.map(String).join('.')}: `;
}

function parseSchema<Schema extends StandardSchemaV1>(
  schema: Schema,
  input: StandardSchemaV1.InferInput<Schema>,
  subject: string,
) {
  const result = schema['~standard'].validate(input);

  if (result instanceof Promise) {
    throw new TypeError(`${subject} schema validation must be synchronous`);
  }

  if (result.issues) {
    const details = result.issues
      .map((issue) => `${formatIssuePath(issue.path)}${issue.message}`)
      .join('; ');

    throw new TypeError(`Invalid error ${subject}: ${details}`);
  }

  return result.value;
}

function parseDefinition<Schema extends StandardSchemaV1>(
  schema: Schema,
  definition: StandardSchemaV1.InferInput<Schema>,
) {
  const parsedDefinition = parseSchema(schema, definition, 'definition');

  if (!isObjectLike(parsedDefinition)) {
    throw new TypeError('definition schema must produce an object');
  }

  return parsedDefinition;
}

function assignProperties(
  error: Error & Record<string, unknown>,
  properties: object,
  dataProperty: string,
  data: unknown,
) {
  for (const key of Reflect.ownKeys(properties)) {
    if (typeof key === 'string' && protectedPropertyNames.has(key)) {
      throw new TypeError(`Cannot overwrite protected error property "${key}"`);
    }

    const descriptor = Object.getOwnPropertyDescriptor(properties, key);

    if (!descriptor) {
      continue;
    }

    if (
      key === dataProperty &&
      (!('value' in descriptor) || descriptor.value !== data)
    ) {
      throw new TypeError(`Cannot overwrite resolved data property "${dataProperty}"`);
    }

    Object.defineProperty(error, key, descriptor);
  }
}

/**
 * Creates an error family with additional instance properties and typed JSON
 * serialization.
 *
 * @param config Defines the family, its public properties, and its serialized
 * representation.
 * @returns A callable factory with a shared `.Error` base class.
 *
 * @example
 * ```ts
 * const createApiError = createError({
 *   definition: z.object({ code: z.string() }),
 *   data: {
 *     property: 'context',
 *     resolve: ({ input }) => input,
 *   },
 *   message: ({ data, implementation }) => implementation(data),
 *   properties: ({ definition }) => ({ code: definition.code }),
 *   toJSON: (error) => ({
 *     code: error.code,
 *     context: error.context,
 *     message: error.message,
 *   }),
 * });
 * ```
 */
export function createError<
  const Schema extends StandardSchemaV1,
  const DataConfig extends CreateErrorConfig<Schema>['data'],
  const MessageCallback extends CreateErrorConfig<Schema>['message'],
  const Properties extends object,
  Json,
>(
  config: SerializedCreateErrorConfig<
    Schema,
    ErrorConfigWithProperties<
      Schema,
      DataConfig,
      MessageCallback,
      Properties
    >,
    Json
  >,
): ErrorFamilyFactory<Schema, typeof config>;

/**
 * Creates an error family with typed JSON serialization and no additional
 * instance properties.
 *
 * @param config Defines the family and its serialized representation.
 * @returns A callable factory with a shared `.Error` base class.
 *
 * @example
 * ```ts
 * const createLogError = createError({
 *   definition: z.object({ code: z.string() }),
 *   data: {
 *     property: 'details',
 *     resolve: ({ input }) => input,
 *   },
 *   message: ({ data, implementation }) => implementation(data),
 *   toJSON: (error) => ({
 *     details: error.details,
 *     message: error.message,
 *   }),
 * });
 * ```
 */
export function createError<
  const Schema extends StandardSchemaV1,
  const DataConfig extends CreateErrorConfig<Schema>['data'],
  const MessageCallback extends CreateErrorConfig<Schema>['message'],
  Json,
>(
  config: SerializedCreateErrorConfig<
    Schema,
    ErrorConfigWithoutProperties<Schema, DataConfig, MessageCallback>,
    Json
  >,
): ErrorFamilyFactory<Schema, typeof config>;

/**
 * Creates a configurable family of strongly typed error classes.
 *
 * Callback execution order is `data.resolve`, optional context validation,
 * `message`, then `properties`. Definition literals and constructor data are
 * inferred without explicit generic arguments or `as const`.
 *
 * @param config Defines the family's schema, data lifecycle, message, and
 * optional public properties.
 * @returns A callable factory with a shared `.Error` base class.
 *
 * @example
 * ```ts
 * const createRequestError = createError({
 *   definition: z.object({ code: z.string() }),
 *   data: {
 *     property: 'context',
 *     resolve: ({ input }) => input,
 *   },
 *   message: ({ data, implementation }) => implementation(data),
 *   properties: ({ definition }) => ({ code: definition.code }),
 * });
 * ```
 */
export function createError<
  const Schema extends StandardSchemaV1,
  const Config extends Omit<CreateErrorConfig<Schema>, 'definition'>,
>(
  config: ExactCreateErrorConfig<Schema, Config>,
): ErrorFamilyFactory<Schema, typeof config>;
export function createError<
  const Schema extends StandardSchemaV1,
  const Config extends Omit<CreateErrorConfig<Schema>, 'definition'>,
>(
  config: ExactCreateErrorConfig<Schema, Config>,
): ErrorFamilyFactory<Schema, typeof config> {
  validateBlueprint(config as CreateErrorConfig<StandardSchemaV1>);

  class FamilyError extends Error {
    static invariant<Condition, Input>(
      this: new (input: Input, options?: ErrorOptions) => Error,
      condition: Condition,
      input: Input | (() => Input),
      options?: ErrorOptions,
    ): asserts condition {
      if (condition) {
        return;
      }

      const resolvedInput =
        typeof input === 'function' ? (input as () => Input)() : input;

      throw new this(resolvedInput, options);
    }

    constructor(message: string, options?: ErrorOptions) {
      super(message, options);
      const name = new.target.name;
      if (name) {
        this.name = name;
      }
    }
  }

  if (config.toJSON) {
    Object.defineProperty(FamilyError.prototype, 'toJSON', {
      configurable: true,
      value: function toJSON(this: Error & Record<string, unknown>) {
        return config.toJSON?.(this as never);
      },
      writable: true,
    });
  }

  function createDefinition<
    const Definition extends StandardSchemaV1.InferInput<Schema>,
  >(definition: Definition) {
    const parsedDefinition = parseDefinition(config.definition, definition);

    function createImplementation(
      implementation: RuntimeImplementation,
      contextSchema?: StandardSchemaV1,
    ) {
      return class extends FamilyError {
        constructor(input: unknown, options?: ErrorOptions) {
          const resolvedData = config.data.resolve({
            definition: parsedDefinition,
            input,
          } as never);
          const data = contextSchema
            ? parseSchema(contextSchema, resolvedData, 'context')
            : resolvedData;
          const implementationWithDefinition: RuntimeImplementation = (
            argument,
          ) =>
            implementation(
              argument === data
                ? argument
                : includeDefinition(argument, parsedDefinition),
            );
          const message = config.message({
            data,
            definition: parsedDefinition,
            implementation: implementationWithDefinition,
          } as never);

          super(message, options);

          Object.defineProperty(this, config.data.property, {
            configurable: true,
            enumerable: true,
            value: data,
            writable: true,
          });

          const properties = config.properties?.({
            data,
            definition: parsedDefinition,
            implementation: implementationWithDefinition,
          } as never);

          if (properties) {
            assignProperties(
              this as Error & Record<string, unknown>,
              properties,
              config.data.property,
              data,
            );
          }
        }
      };
    }

    function implement(implementation: RuntimeImplementation) {
      return createImplementation(implementation);
    }

    function defineContext<ContextSchema extends StandardSchemaV1>(
      contextSchema: ContextSchema,
    ) {
      validateStandardSchema(contextSchema, 'context');

      return {
        implement(implementation: RuntimeImplementation) {
          return createImplementation(implementation, contextSchema);
        },
      };
    }

    return {
      defineContext,
      implement,
    };
  }

  return Object.assign(createDefinition, {
    Error: FamilyError,
  }) as unknown as ErrorFamilyFactory<Schema, typeof config>;
}
