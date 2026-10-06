import type { StandardSchemaV1 } from '@standard-schema/spec';

declare const typeSlot: unique symbol;

/** Marks a blueprint value that is resolved by a later builder stage. */
type TypeSlot<Kind extends string, Payload = never> = {
  readonly [typeSlot]: {
    readonly kind: Kind;
    readonly payload: Payload;
  };
};

type DefinitionInput<Schema extends StandardSchemaV1> =
  StandardSchemaV1.InferInput<Schema>;

type DefinitionOutput<Schema extends StandardSchemaV1> =
  StandardSchemaV1.InferOutput<Schema>;

type ExactDefinition<Input, Definition> = Input extends object
  ? Definition & Record<Exclude<keyof Definition, keyof Input>, never>
  : Definition;

type DefinitionTemplate<Schema extends StandardSchemaV1> =
  DefinitionOutput<Schema> extends object
    ? {
        readonly [Key in keyof DefinitionOutput<Schema>]: DefinitionOutput<Schema>[Key] &
          TypeSlot<'definition', Key>;
      }
    : never;

type ConcreteDefinition<Schema extends StandardSchemaV1, Input> =
  DefinitionOutput<Schema> extends object
    ? {
        readonly [Key in keyof DefinitionOutput<Schema>]: Key extends keyof Input
          ? Input[Key] extends DefinitionOutput<Schema>[Key]
            ? Input[Key]
            : DefinitionOutput<Schema>[Key]
          : DefinitionOutput<Schema>[Key];
      }
    : never;

type DataSlot = TypeSlot<'data'>;

type ImplementationSlot = TypeSlot<'implementation'> & {
  <const Argument>(
    argument: Argument,
  ): string & TypeSlot<'implementationArgument', Argument>;
};

/** Values available while an error instance is being created. */
export interface BlueprintContext<Schema extends StandardSchemaV1> {
  /** The parsed definition captured by the concrete error class. */
  definition: DefinitionTemplate<Schema>;

  /** The resolved, and optionally schema-validated, constructor data. */
  data: DataSlot;

  /**
   * Calls the concrete error's implementation with one argument.
   *
   * The argument passed here defines the implementation callback's parameter
   * type. Concrete definition fields are included automatically when the
   * argument is a plain object.
   */
  implementation: ImplementationSlot;
}

/** Values available when resolving a concrete error's constructor input. */
export interface ResolveContext<Schema extends StandardSchemaV1> {
  /** The parsed definition captured by the concrete error class. */
  definition: DefinitionTemplate<Schema>;

  /** The value passed to the concrete error constructor. */
  input: object;
}

/**
 * Configuration accepted by {@link createError}.
 *
 * @example
 * ```ts
 * const config = {
 *   definition,
 *   data: {
 *     property: 'context',
 *     resolve: ({ input }) => input,
 *   },
 *   message: ({ data, implementation }) => implementation(data),
 * } satisfies CreateErrorConfig<typeof definition>;
 * ```
 */
export interface CreateErrorConfig<Schema extends StandardSchemaV1> {
  /**
   * A Standard Schema object that parses every concrete error definition.
   * Validation must be synchronous because class creation is synchronous.
   */
  definition: Schema;

  /**
   * Controls how constructor input becomes the error's stored data.
   *
   * Use `resolve` to normalize input or combine it with the concrete
   * definition. The resulting value is validated by `defineContext`, when
   * present, and then stored under `property` on every error instance.
   *
   * @example Preserve input while adding a definition value
   * ```ts
   * data: {
   *   property: 'context',
   *   resolve: ({ definition, input }) => ({
   *     ...input,
   *     scope: definition.scope,
   *   }),
   * }
   * ```
   */
  data: {
    /**
     * The public instance property that receives the final resolved data.
     *
     * For example, `property: 'context'` makes `error.context` available.
     */
    property: string;

    /**
     * Converts constructor input into the value used by the error blueprint.
     *
     * This callback runs first. It can return the input unchanged, normalize
     * it, or add values from the concrete definition. Its result becomes the
     * input to the optional context schema.
     */
    resolve(context: ResolveContext<Schema>): unknown;
  };

  /**
   * Creates the native `Error.message` after data resolution and validation.
   */
  message(context: BlueprintContext<Schema>): string;

  /**
   * Creates additional public fields and methods for each error instance.
   *
   * Use this to expose definition values such as `code`, derive fields from
   * resolved data, or attach convenience methods. It does not transform or
   * validate constructor input; use `data.resolve` and `defineContext` for
   * that.
   *
   * @example Expose definition and resolved-data values
   * ```ts
   * properties: ({ definition, data }) => ({
   *   code: definition.code,
   *   context: data,
   *   describe: () => `${definition.code}: ${data.field}`,
   * })
   * ```
   */
  properties?(context: BlueprintContext<Schema>): object;

  /**
   * Serializes every error in the family when `toJSON()` or `JSON.stringify`
   * is called.
   *
   * The callback receives the fully constructed error, including the data
   * property and any fields or methods returned by `properties`.
   *
   * @example Return an API-safe error representation
   * ```ts
   * toJSON: (error) => ({
   *   name: error.name,
   *   code: error.code,
   *   message: error.message,
   *   context: error.context,
   * })
   * ```
   */
  toJSON?(error: Error & Record<string, unknown>): unknown;
}

type ResolveTemplate<Config> = Config extends {
  data: { resolve: (...arguments_: infer _Arguments) => infer Resolved };
}
  ? Resolved
  : never;

type InjectedDefinitionKeys<Template> = {
  [Key in keyof Template]: Template[Key] extends TypeSlot<
    'definition',
    PropertyKey
  >
    ? Key
    : never;
}[keyof Template];

type ConstructorInput<Config, Data> = Data extends readonly unknown[]
  ? Data
  : Data extends object
    ? Omit<
        Data,
        Extract<InjectedDefinitionKeys<ResolveTemplate<Config>>, keyof Data>
      >
    : Data;

type ReplaceTuple<
  Values extends readonly unknown[],
  Definition,
  Data,
  Implementation,
> = {
  [Index in keyof Values]: ReplaceTemplate<
    Values[Index],
    Definition,
    Data,
    Implementation
  >;
};

type ReplaceTemplate<Type, Definition, Data, Implementation> =
  Type extends TypeSlot<'definition', infer Key>
    ? Key extends keyof Definition
      ? Definition[Key]
      : never
    : Type extends TypeSlot<'data'>
      ? Data
      : Type extends TypeSlot<'implementation'>
        ? Implementation
        : Type extends (...arguments_: infer Arguments) => infer Result
          ? (
              ...arguments_: ReplaceTuple<
                Arguments,
                Definition,
                Data,
                Implementation
              >
            ) => ReplaceTemplate<Result, Definition, Data, Implementation>
          : Type extends readonly unknown[]
            ? ReplaceTuple<Type, Definition, Data, Implementation>
            : Type extends object
              ? {
                  [Key in keyof Type]: ReplaceTemplate<
                    Type[Key],
                    Definition,
                    Data,
                    Implementation
                  >;
                }
              : Type;

type PropertiesTemplate<Config> = Config extends {
  properties: (...arguments_: infer _Arguments) => infer Properties;
}
  ? Properties
  : object;

type DataPropertyTemplate<Config> = Config extends {
  data: { property: infer Property extends string };
}
  ? { [Key in Property]: DataSlot }
  : object;

/**
 * The error shape visible to a blueprint's `toJSON` callback.
 *
 * It contains native `Error` fields, the configured data property, and every
 * member returned by `properties`.
 */
export type BlueprintErrorTemplate<Config> = Error &
  DataPropertyTemplate<Config> &
  PropertiesTemplate<Config>;

type InstanceProperties<Config, Definition, Data, Implementation> =
  ReplaceTemplate<
    PropertiesTemplate<Config>,
    Definition,
    Data,
    Implementation
  > &
    Error &
    (Config extends {
      toJSON: (...arguments_: infer _Arguments) => infer Json;
    }
      ? {
          toJSON(): ReplaceTemplate<Json, Definition, Data, Implementation>;
        }
      : object);

type MessageTemplate<Config> = Config extends {
  message: (...arguments_: infer _Arguments) => infer Message;
}
  ? Message
  : string;

type ImplementationArgumentWithDefinition<Argument, Definition, Data> =
  Argument extends TypeSlot<'data'>
    ? Data
    : ReplaceTemplate<Argument, Definition, Data, never> extends infer Resolved
      ? Argument extends TypeSlot<string, unknown>
        ? Resolved
        : Resolved extends readonly unknown[]
          ? Resolved
          : Resolved extends (...arguments_: infer _Arguments) => unknown
            ? Resolved
            : Resolved extends object
              ? Omit<Definition, keyof Resolved> & Resolved
              : Resolved
      : never;

type ImplementationArgument<Config, Definition, Data> =
  MessageTemplate<Config> extends TypeSlot<
    'implementationArgument',
    infer Argument
  >
    ? ImplementationArgumentWithDefinition<Argument, Definition, Data>
    : never;

type ImplementationCallback<Config, Definition, Data> = (
  argument: ImplementationArgument<Config, Definition, Data>,
) => string;

interface ErrorClassStatics {
  /**
   * Throws this error class when `condition` is falsy.
   *
   * A function can be supplied as `input` to avoid constructing error data
   * unless the invariant fails. TypeScript narrows `condition` after a
   * successful call.
   *
   * @example
   * ```ts
   * MissingUserError.invariant(
   *   user,
   *   () => ({ userId }),
   *   { cause },
   * );
   *
   * user.id; // narrowed to the truthy branch
   * ```
   */
  invariant<Condition, Input>(
    this: new (input: Input, options?: ErrorOptions) => Error,
    condition: Condition,
    input: Input | (() => Input),
    options?: ErrorOptions,
  ): asserts condition;
}

/**
 * The shared native `Error` base created for one blueprint.
 *
 * Use `factory.Error` for family-wide `instanceof` checks or as a public base
 * type for errors created by the same blueprint.
 */
export type FamilyErrorClass = (abstract new (
  ...arguments_: never[]
) => Error) &
  ErrorClassStatics;

/** An extendable concrete error class produced by a configured factory. */
interface ConcreteErrorClass<Input, Instance> extends ErrorClassStatics {
  /**
   * Creates an error from family-specific input.
   *
   * Pass native `ErrorOptions` as the second argument to preserve a `cause`.
   */
  new (input: Input, options?: ErrorOptions): Instance;
}

type ImplementedErrorClass<Config, Definition, Input, Data> =
  ConcreteErrorClass<
    ConstructorInput<Config, Input>,
    InstanceProperties<
      Config,
      Definition,
      Data,
      ImplementationCallback<Config, Definition, Data>
    >
  >;

type ExtendsNever<Value, OnTrue, OnFalse> = [Value] extends [never]
  ? OnTrue
  : OnFalse;

type BuilderData<Data, InferredData> = ExtendsNever<Data, InferredData, Data>;

type DefaultBuilderData<Data> = ExtendsNever<Data, unknown, Data>;

type BuilderInput<Input, Data> = ExtendsNever<Input, Data, Input>;

type Expand<Type> = Type extends (...arguments_: infer Arguments) => infer Result
  ? (...arguments_: Arguments) => Result
  : Type;

/** Captures the final behavior for one concrete error class. */
export interface ImplementationBuilder<
  Config,
  Definition,
  Input = never,
  Data = never,
> {
  /**
   * Creates an extendable error class from a message implementation.
   *
   * The callback receives the single argument chosen by the blueprint's call
   * to `implementation(argument)`. When that argument is a plain object, the
   * concrete definition's fields are also available on it.
   *
   * @example
   * ```ts
   * const MissingUserError = createRequestError({
   *   code: 'missingUser',
   * }).implement(
   *   ({ code, context }) => `${code}: ${context.userId} was not found`,
   * );
   * ```
   */
  implement<InferredData = DefaultBuilderData<Data>>(
    implementation: Expand<ImplementationCallback<
      Config,
      Definition,
      BuilderData<Data, InferredData>
    >>,
  ): ImplementedErrorClass<
    Config,
    Definition,
    BuilderInput<Input, BuilderData<Data, InferredData>>,
    BuilderData<Data, InferredData>
  >;
}

/** Configures one concrete error definition before creating its class. */
export interface ErrorDefinitionBuilder<
  Config,
  Definition,
> extends ImplementationBuilder<Config, Definition> {
  /**
   * Validates and optionally transforms resolved data with a Standard Schema.
   *
   * The schema's input becomes the concrete class's constructor input and its
   * output becomes the stored data and implementation value. Validation must
   * be synchronous. After selecting a schema, only `implement` is available.
   *
   * @example
   * ```ts
   * const MissingUserError = createRequestError({ code: 'missingUser' })
   *   .defineContext(z.object({ userId: z.string() }))
   *   .implement(({ userId }) => `User ${userId} was not found`);
   *
   * new MissingUserError({ userId: 'user_123' });
   * ```
   */
  defineContext<const ContextSchema extends StandardSchemaV1>(
    context: ContextSchema,
  ): ImplementationBuilder<
    Config,
    Definition,
    StandardSchemaV1.InferInput<ContextSchema>,
    StandardSchemaV1.InferOutput<ContextSchema>
  >;
}

/**
 * A callable factory for creating related, strongly typed error classes.
 *
 * Call it with a concrete definition to receive a builder, or use `.Error` as
 * the common base class for every error produced by this factory.
 */
export type ErrorFamilyFactory<Schema extends StandardSchemaV1, Config> = {
  /**
   * Parses and captures a concrete definition while preserving compatible
   * literal values in the resulting error class.
   *
   * @example
   * ```ts
   * const builder = createRequestError({
   *   code: 'missingUser',
   *   scope: 'request',
   * });
   * ```
   */
  <const Definition extends DefinitionInput<Schema>>(
    definition: ExactDefinition<DefinitionInput<Schema>, Definition>,
  ): ErrorDefinitionBuilder<Config, ConcreteDefinition<Schema, Definition>>;

  /**
   * The shared native `Error` base for every class created by this factory.
   *
   * @example
   * ```ts
   * error instanceof createRequestError.Error;
   * ```
   */
  Error: FamilyErrorClass;
};
