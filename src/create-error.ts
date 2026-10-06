import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { BlueprintConfig, ErrorFamilyFactory } from './types.js';

type RuntimeImplementation = (...arguments_: never[]) => string;

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

function validateBlueprint(config: BlueprintConfig<StandardSchemaV1>) {
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
 * Creates a configurable family of strongly typed error classes.
 *
 * The returned callable parses a concrete definition with the configured
 * Standard Schema, then returns a builder that optionally parses resolved
 * context before capturing an implementation. All classes from one blueprint
 * inherit from the generated `.Error` base.
 *
 * Callback execution order is `data.resolve`, optional context validation,
 * `message`, then `properties`. Definition literals and constructor data are
 * inferred without explicit generic arguments or `as const` at ordinary call
 * sites.
 */
export function createError<
  const Schema extends StandardSchemaV1,
  const Config extends Omit<BlueprintConfig<Schema>, 'definition'>,
>(
  config: { definition: Schema } & Config &
    (StandardSchemaV1.InferOutput<Schema> extends object
      ? unknown
      : { definition: never }),
): ErrorFamilyFactory<Schema, { definition: Schema } & Config> {
  validateBlueprint(config as BlueprintConfig<StandardSchemaV1>);

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
      this.name = new.target.name;
    }
  }

  if (config.toJSON) {
    Object.defineProperty(FamilyError.prototype, 'toJSON', {
      configurable: true,
      value: function toJSON(this: Error & Record<string, unknown>) {
        return config.toJSON?.(this);
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
      return class CreatedError extends FamilyError {
        constructor(input: unknown, options?: ErrorOptions) {
          const resolvedData = config.data.resolve({
            definition: parsedDefinition,
            input,
          } as never);
          const data = contextSchema
            ? parseSchema(contextSchema, resolvedData, 'context')
            : resolvedData;
          const message = config.message({
            data,
            definition: parsedDefinition,
            implementation,
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
            implementation,
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
  }) as unknown as ErrorFamilyFactory<
    Schema,
    { definition: Schema } & Config
  >;
}
