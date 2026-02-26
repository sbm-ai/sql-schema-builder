import { Schema, SQLDialect, Table, Column, Relationship } from './types';

export class SQLGenerator {
  constructor(private dialect: SQLDialect = 'ACCESS') {}

  generate(schema: Schema): string {
    let sql = '';
    
    // Header comment
    sql += this.generateHeader();
    sql += '\n\n';
    
    // Фильтруем M:N связи - они будут обработаны через junction таблицы
    const nonMNRelationships = schema.relationships.filter(rel => rel.cardinality !== 'N:M');
    const mnRelationships = schema.relationships.filter(rel => rel.cardinality === 'N:M');
    
    // Сначала создаём junction таблицы для N:M связей
    for (const rel of mnRelationships) {
      sql += this.generateJunctionTable(rel, schema.tables);
      sql += '\n';
    }
    
    // Создаём схему с автоматически добавленными FK полями (только для не-M:N связей)
    const schemaWithFK = this.addForeignKeyFields({ tables: schema.tables, relationships: nonMNRelationships });
    
    // CREATE TABLE statements
    for (const table of schemaWithFK.tables) {
      sql += this.generateCreateTable(table);
      sql += '\n\n';
    }
    
    // ALTER TABLE for foreign key constraints (только для не-M:N связей)
    for (const rel of nonMNRelationships) {
      const alterSQL = this.generateForeignKeyConstraint(rel, schemaWithFK.tables);
      if (alterSQL) {
        sql += alterSQL + '\n';
      }
    }
    
    return sql;
  }

  // Добавляем поля Foreign Key в таблицы на стороне "многие"
  private addForeignKeyFields(schema: Schema): Schema {
    const tables = schema.tables.map(t => ({...t, columns: [...t.columns]}));
    
    for (const rel of schema.relationships) {
      const sourceTable = tables.find(t => t.id === rel.sourceTableId);
      const targetTable = tables.find(t => t.id === rel.targetTableId);
      
      if (!sourceTable || !targetTable) continue;
      
      // Находим колонки, которые УЧАСТВУЮТ в связи (по ID из relationship)
      const sourceColumn = sourceTable.columns.find(c => c.id === rel.sourceColumnId);
      const targetColumn = targetTable.columns.find(c => c.id === rel.targetColumnId);
      
      if (!sourceColumn || !targetColumn) continue;
      
      // Пропускаем N:M - они обрабатываются через junction таблицы
      if (rel.cardinality === 'N:M') continue;
      
      // Находим ПЕРВИЧНЫЙ КЛЮЧ каждой таблицы
      const sourcePK = sourceTable.columns.find(c => c.primaryKey);
      const targetPK = targetTable.columns.find(c => c.primaryKey);
      
      if (!sourcePK || !targetPK) continue;
      
      // Определяем, какая таблица на стороне "многие"
      let manyTableId: string;
      let fkColumnName: string;
      let pkColumn: Column | undefined;
      
      switch (rel.cardinality) {
        case '1:N':
          // Source (1) -> Target (N) - FK в Target
          // FK должен называться по имени PK источника!
          manyTableId = rel.targetTableId;
          fkColumnName = sourcePK.name;  // Например: tovar_id (имя PK таблицы Tovar)
          pkColumn = sourcePK;
          break;
        case 'N:1':
          // Source (N) -> Target (1) - FK в Source
          manyTableId = rel.sourceTableId;
          fkColumnName = targetPK.name;  // Например: user_id (имя PK таблицы User)
          pkColumn = targetPK;
          break;
        case '1:1':
          // Для 1:1 выбираем таблицу с необязательной связью
          if (rel.targetOptional) {
            manyTableId = rel.targetTableId;
            fkColumnName = sourcePK.name;
            pkColumn = sourcePK;
          } else if (rel.sourceOptional) {
            manyTableId = rel.sourceTableId;
            fkColumnName = targetPK.name;
            pkColumn = targetPK;
          } else {
            continue; // Обе стороны обязательные - пропускаем авто-FK
          }
          break;
        default:
          continue;
      }
      
      if (!pkColumn) continue;
      
      // Проверяем, не добавлено ли уже это поле
      const existingTable = tables.find(t => t.id === manyTableId);
      if (existingTable && !existingTable.columns.some(c => c.name === fkColumnName)) {
        // Сохраняем ТОЧНО ТИП первичного ключа (включая TEXT, AUTOINCREMENT и т.д.)
        const fkType = pkColumn.type;
        
        const fkColumn: Column = {
          id: `fk-${rel.id}-${manyTableId}`,
          name: fkColumnName,
          type: fkType as any,  // Сохраняем оригинальный тип PK!
          primaryKey: false,
          nullable: rel.sourceOptional || rel.targetOptional,
          unique: rel.cardinality === '1:1',
          autoIncrement: false
        };
        
        // Добавляем колонку в таблицу
        const tableIndex = tables.findIndex(t => t.id === manyTableId);
        if (tableIndex >= 0) {
          tables[tableIndex] = {
            ...tables[tableIndex],
            columns: [...tables[tableIndex].columns, fkColumn]
          };
        }
      }
    }
    
    return { tables, relationships: schema.relationships };
  }

  private generateJunctionTable(rel: Relationship, tables: Table[]): string {
    const sourceTable = tables.find(t => t.id === rel.sourceTableId);
    const targetTable = tables.find(t => t.id === rel.targetTableId);
    
    if (!sourceTable || !targetTable) return '';
    
    // Находим ПЕРВИЧНЫЕ КЛЮЧИ обеих таблиц!
    const sourcePK = sourceTable.columns.find(c => c.primaryKey);
    const targetPK = targetTable.columns.find(c => c.primaryKey);
    
    if (!sourcePK || !targetPK) return '';
    
    const junctionName = `${sourceTable.name}_${targetTable.name}`;
    
    // Типы данных - используем ТОЧНЫЕ типы ПЕРВИЧНЫХ КЛЮЧЕЙ!
    const sourceType = this.mapDataType(sourcePK.type);
    const targetType = this.mapDataType(targetPK.type);
    
    // Имена колонок - имена ПЕРВИЧНЫХ КЛЮЧЕЙ!
    const sourceColName = sourcePK.name;  // Например: tovar_id
    const targetColName = targetPK.name;  // Например: user_id
    
    let sql = `CREATE TABLE [${junctionName}] (\n`;
    sql += `    [${sourceColName}] ${sourceType} NOT NULL,\n`;
    sql += `    [${targetColName}] ${targetType} NOT NULL,\n`;
    sql += `    CONSTRAINT [PK_${junctionName}] PRIMARY KEY ([${sourceColName}], [${targetColName}]),\n`;
    sql += `    CONSTRAINT [FK_${junctionName}_${sourceTable.name}] FOREIGN KEY ([${sourceColName}]) REFERENCES [${sourceTable.name}]([${sourcePK.name}]),\n`;
    sql += `    CONSTRAINT [FK_${junctionName}_${targetTable.name}] FOREIGN KEY ([${targetColName}]) REFERENCES [${targetTable.name}]([${targetPK.name}])\n`;
    sql += ');\n\n';
    
    return sql;
  }

  private generateHeader(): string {
    const now = new Date().toLocaleString('ru-RU');
    return `-- SQL Schema Generated by SQL Schema Builder
-- Dialect: ${this.dialect}
-- Generated: ${now}

`;
  }

  private generateCreateTable(table: Table): string {
    let sql = `CREATE TABLE [${table.name}] (\n`;
    
    const columnDefs = table.columns.map(col => this.generateColumnDef(col));
    sql += columnDefs.map(def => `    ${def}`).join(',\n');
    
    // Primary key constraint
    const primaryKeyColumns = table.columns.filter(c => c.primaryKey);
    if (primaryKeyColumns.length > 0) {
      const pkCols = primaryKeyColumns.map(c => `[${c.name}]`).join(', ');
      sql += `,\n    CONSTRAINT [PK_${table.name}] PRIMARY KEY (${pkCols})`;
    }
    
    sql += '\n);';
    
    return sql;
  }

  private generateColumnDef(column: Column): string {
    let def = `[${column.name}] ${this.mapDataType(column.type)}`;
    
    if (column.autoIncrement && column.type === 'AUTOINCREMENT') {
      def += ' COUNTER';
    }
    
    if (!column.nullable) {
      def += ' NOT NULL';
    }
    
    if (column.unique && !column.primaryKey) {
      def += ' UNIQUE';
    }
    
    return def;
  }

  private mapDataType(type: string): string {
    const typeMap: Record<string, string> = {
      'TEXT': 'VARCHAR(255)',
      'INTEGER': 'INTEGER',
      'LONG': 'LONG',
      'DOUBLE': 'DOUBLE',
      'CURRENCY': 'CURRENCY',
      'DATETIME': 'DATETIME',
      'BOOLEAN': 'BIT',
      'AUTOINCREMENT': 'COUNTER',
      'MEMO': 'LONGTEXT',
      'OLE': 'OLEOBJECT'
    };

    return typeMap[type] || 'VARCHAR(255)';
  }

  private generateForeignKeyConstraint(rel: Relationship, tables: Table[]): string {
    const sourceTable = tables.find(t => t.id === rel.sourceTableId);
    const targetTable = tables.find(t => t.id === rel.targetTableId);
    
    if (!sourceTable || !targetTable) return '';
    
    // Находим ПЕРВИЧНЫЕ КЛЮЧИ обеих таблиц
    const sourcePK = sourceTable.columns.find(c => c.primaryKey);
    const targetPK = targetTable.columns.find(c => c.primaryKey);
    
    if (!sourcePK || !targetPK) return '';
    
    // Для N:M не делаем ALTER TABLE - создаём junction таблицу
    if (rel.cardinality === 'N:M') {
      return '';
    }
    
    // Определяем где FK
    let fkColumnName: string;
    let fkTable: Table;
    let pkColumn: Column;
    
    switch (rel.cardinality) {
      case '1:N':
        // FK в target таблице, ссылается на PK source
        fkColumnName = sourcePK.name;
        fkTable = targetTable;
        pkColumn = sourcePK;
        break;
      case 'N:1':
        // FK в source таблице, ссылается на PK target
        fkColumnName = targetPK.name;
        fkTable = sourceTable;
        pkColumn = targetPK;
        break;
      case '1:1':
        if (rel.targetOptional) {
          fkColumnName = sourcePK.name;
          fkTable = targetTable;
          pkColumn = sourcePK;
        } else if (rel.sourceOptional) {
          fkColumnName = targetPK.name;
          fkTable = sourceTable;
          pkColumn = targetPK;
        } else {
          return '';
        }
        break;
      default:
        return '';
    }
    
    const fkName = `FK_${fkTable.name}_${targetTable.name}`;
    
    let sql = `ALTER TABLE [${fkTable.name}]\n`;
    sql += `    ADD CONSTRAINT [${fkName}] FOREIGN KEY ([${fkColumnName}])\n`;
    sql += `    REFERENCES [${targetTable.name}]([${pkColumn.name}])`;
    
    // Add ON DELETE and ON UPDATE based on relationship settings
    if (rel.onDelete !== 'NO ACTION') {
      sql += `\n    ON DELETE ${rel.onDelete}`;
    }
    
    if (rel.onUpdate !== 'NO ACTION') {
      sql += `\n    ON UPDATE ${rel.onUpdate}`;
    }
    
    sql += ';';
    
    return sql;
  }

  exportToFile(schema: Schema, filename: string = 'schema.sql'): void {
    const sql = this.generate(schema);
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
