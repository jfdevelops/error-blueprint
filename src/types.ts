import type { StandardSchemaV1 } from '@standard-schema/spec';

declare const dataPlaceholderBrand: unique symbol;
declare const definitionFieldBrand: unique symbol;
declare const implementationArgumentBrand: unique symbol;
declare const implementationPlaceholderBrand: unique symbol;
declare const inputPlaceholderBrand: unique symbol;

type DefinitionInput<Schema extends StandardSchemaV1> =
  StandardSchemaV1.InferInput<Schema>;

type DefinitionOutput<Schema extends StandardSchemaV1> =
  StandardSchemaV1.InferOutput<Schema>;

type ExactDefinition<Input, Definition> = Input extends object
  ? Definition & Record<Exclude<keyof Definition, keyof Input>, never>
  : Definition;

type DefinitionPlaceholder<Schema extends StandardSchemaV1> =
  DefinitionOutput<Schema> extends object
    ? {
        readonly [Key in keyof DefinitionOutput<Schema>]: DefinitionOutput<Schema>[Key] & {
          readonly [definitionFieldBrand]: Key;
        };
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

interface DataPlaceholder {
  readonly [dataPlaceholderBrand]: true;
}

interface InputPlaceholder {
  readonly [inputPlaceholderBrand]: true;
}

type ImplementationPlaceholder = {
  <const Argument>(argument: Argument): string & {
    readonly [implementationArgumentBrand]: Argument;
  };
  readonly [implementationPlaceholderBrand]: true;
};

interface BlueprintContext<Schema extends StandardSchemaV1> {
  definition: DefinitionPlaceholder<Schema>;
  data: DataPlaceholder;
  implementation: ImplementationPlaceholder;
}

interface ResolveContext<Schema extends StandardSchemaV1> {
  definition: DefinitionPlaceholder<Schema>;
  input: InputPlaceholder;
}

/** Configuration used to create one related family of error classes. */
export interface BlueprintConfig<Schema extends StandardSchemaV1> {
  /**
   * A Standard Schema object that parses every concrete error definition.
   * Validation must be synchronous because class creation is synchronous.
   */
  definition: Schema;

  data: {
    /** The instance property that receives the resolved data. */
    property: string;
    /** Resolves constructor input before message and property callbacks run. */
    resolve(context: ResolveContext<Schema>): unknown;
  };

  /** Creates the native `Error.message` after data resolution. */
  message(context: BlueprintContext<Schema>): string;

  /** Creates additional instance properties and methods after the message. */
  properties?(context: BlueprintContext<Schema>): object;

  /** Enables custom JSON serialization for every error in the family. */
  toJSON?(error: Error & Record<string, unknown>): unknown;
}

type ResolveTemplate<Config> = Config extends {
  data: { resolve: (...arguments_: infer _Arguments) => infer Resolved };
}
  ? Resolved
  : never;

type InjectedDefinitionKeys<Template> = {
  [Key in keyof Template]: Template[Key] extends {
    readonly [definitionFieldBrand]: PropertyKey;
  }
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

type ReplaceTemplate<Type, Definition, Data, Implementation> = Type extends {
  readonly [definitionFieldBrand]: infer Key;
}
  ? Key extends keyof Definition
    ? Definition[Key]
    : never
  : Type extends { readonly [dataPlaceholderBrand]: true }
    ? Data
    : Type extends { readonly [implementationPlaceholderBrand]: true }
      ? Implementation
      : Type extends { readonly [inputPlaceholderBrand]: true }
        ? ConstructorInput<unknown, Data>
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
      ? { toJSON(): Json }
      : object);

type MessageTemplate<Config> = Config extends {
  message: (...arguments_: infer _Arguments) => infer Message;
}
  ? Message
  : string;

type ImplementationArgument<Config, Definition, Data> =
  MessageTemplate<Config> extends {
    readonly [implementationArgumentBrand]: infer Argument;
  }
    ? ReplaceTemplate<Argument, Definition, Data, never>
    : never;

type ImplementationCallback<Config, Definition, Data> = (
  argument: ImplementationArgument<Config, Definition, Data>
) => string;

interface ErrorClassStatics {
  invariant<Condition, Input>(
    this: new (input: Input, options?: ErrorOptions) => Error,
    condition: Condition,
    input: Input | (() => Input),
    options?: ErrorOptions,
  ): asserts condition;
}

/** The shared native `Error` base created for one blueprint. */
export type FamilyErrorClass = (abstract new (
  ...arguments_: never[]
) => Error) &
  ErrorClassStatics;

/** An extendable concrete error class produced by a configured factory. */
type ConcreteErrorClass<Input, Instance> = (new (
  input: Input,
  options?: ErrorOptions,
) => Instance) &
  ErrorClassStatics;

/** Builds a concrete error class after a context schema has been selected. */
export type ContextDefinitionBuilder<
  Config,
  Definition,
  ContextSchema extends StandardSchemaV1,
> = {
  implement(
    implementation: ImplementationCallback<
      Config,
      Definition,
      StandardSchemaV1.InferOutput<ContextSchema>
    >,
  ): ConcreteErrorClass<
    ConstructorInput<Config, StandardSchemaV1.InferInput<ContextSchema>>,
    InstanceProperties<
      Config,
      Definition,
      StandardSchemaV1.InferOutput<ContextSchema>,
      ImplementationCallback<
        Config,
        Definition,
        StandardSchemaV1.InferOutput<ContextSchema>
      >
    >
  >;
};

/** Selects optional context validation and captures a consumer implementation. */
export type ErrorDefinitionBuilder<Config, Definition> = {
  defineContext<const ContextSchema extends StandardSchemaV1>(
    context: ContextSchema,
  ): ContextDefinitionBuilder<Config, Definition, ContextSchema>;

  implement<Data>(
    implementation: ImplementationCallback<Config, Definition, Data>,
  ): ConcreteErrorClass<
    ConstructorInput<Config, Data>,
    InstanceProperties<
      Config,
      Definition,
      Data,
      ImplementationCallback<Config, Definition, Data>
    >
  >;
};

export type ErrorFamilyFactory<Schema extends StandardSchemaV1, Config> = {
  /** Parses a definition while preserving compatible literal fields. */
  <const Definition extends DefinitionInput<Schema>>(
    definition: ExactDefinition<DefinitionInput<Schema>, Definition>,
  ): ErrorDefinitionBuilder<Config, ConcreteDefinition<Schema, Definition>>;

  /** The shared native `Error` base for every class created by this factory. */
  Error: FamilyErrorClass;
};
