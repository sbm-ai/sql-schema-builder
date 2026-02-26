     export type DataType = 'TEXT' | 'INTEGER' | 'LONG' | 'DOUBLE' | 'CURRENCY' | 'DATETIME' | 'BOOLEAN' | 'AUTOINCREMENT' | 'MEMO' | 'OLE';

// Conceptual Model Types
export type AttributeType = 'PRIMARY' | 'NORMAL' | 'MULTIVALUED' | 'DERIVED';

export interface Attribute {
  id: string;
  name: string;
  type: AttributeType;
  dataType?: DataType; // Сохраняем тип данных для обратного преобразования
}

export interface Column {
  id: string;
  name: string;
  type: DataType;
  primaryKey: boolean;
  nullable: boolean;
  unique: boolean;
  autoIncrement: boolean;
  // Foreign Key fields
  isForeignKey?: boolean;
  referencesTable?: string;
  referencesColumn?: string;
}

export interface Table {
  id: string;
  name: string;
  columns: Column[];
  x: number;
  y: number;
}

export interface Relationship {
  id: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  cardinality: '1:1' | '1:N' | 'N:1' | 'N:M';
  sourceOptional: boolean;
  targetOptional: boolean;
  onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface Schema {
  tables: Table[];
  relationships: Relationship[];
}

export type SQLDialect = 'ACCESS' | 'SQLITE' | 'MYSQL' | 'POSTGRESQL';

export type SchemaMode = 'CONCEPTUAL' | 'LOGICAL';

export interface Entity {
  id: string;
  name: string;
  attributes: Attribute[];
  x: number;
  y: number;
}

export interface ConceptualRelationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  cardinality: '1:1' | '1:N' | 'N:1' | 'N:M';
  sourceOptional: boolean;
  targetOptional: boolean;
  role: string;
}

export interface ConceptualSchema {
  entities: Entity[];
  relationships: ConceptualRelationship[];
}

