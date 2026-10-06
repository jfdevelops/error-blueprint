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

export interface BlueprintContext<Schema extends StandardSchemaV1> {
  definition: DefinitionTemplate<Schema>;
  data: DataSlot;
  implementation: ImplementationSlot;
}

export interface ResolveContext<Schema extends StandardSchemaV1> {
  definition: DefinitionTemplate<Schema>;
  input: object;
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

type ImplementationArgument<Config, Definition, Data> =
  MessageTemplate<Config> extends TypeSlot<
    'implementationArgument',
    infer Argument
  >
    ? ReplaceTemplate<Argument, Definition, Data, never>
    : never;

type ImplementationCallback<Config, Definition, Data> = (
  argument: ImplementationArgument<Config, Definition, Data>,
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
interface ConcreteErrorClass<Input, Instance> extends ErrorClassStatics {
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

/** Captures an implementation after its constructor and resolved data are known. */
export interface ImplementationBuilder<
  Config,
  Definition,
  Input = never,
  Data = never,
> {
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

/** Selects optional context validation and captures a consumer implementation. */
export interface ErrorDefinitionBuilder<
  Config,
  Definition,
> extends ImplementationBuilder<Config, Definition> {
  defineContext<const ContextSchema extends StandardSchemaV1>(
    context: ContextSchema,
  ): ImplementationBuilder<
    Config,
    Definition,
    StandardSchemaV1.InferInput<ContextSchema>,
    StandardSchemaV1.InferOutput<ContextSchema>
  >;
}

export type ErrorFamilyFactory<Schema extends StandardSchemaV1, Config> = {
  /** Parses a definition while preserving compatible literal fields. */
  <const Definition extends DefinitionInput<Schema>>(
    definition: ExactDefinition<DefinitionInput<Schema>, Definition>,
  ): ErrorDefinitionBuilder<Config, ConcreteDefinition<Schema, Definition>>;

  /** The shared native `Error` base for every class created by this factory. */
  Error: FamilyErrorClass;
};
