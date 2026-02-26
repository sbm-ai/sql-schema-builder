import React from 'react';
import { Button } from 'react-bootstrap';
import { Table, Relationship, Entity, ConceptualRelationship } from '../types';

interface RecommendationPanelProps {
  tables: Table[];
  entities: Entity[];
  relationships: Relationship[];
  conceptualRelationships: ConceptualRelationship[];
  schemaMode: 'CONCEPTUAL' | 'LOGICAL';
  onCreateJunctionTable: (sourceTable: Table, targetTable: Table) => void;
  onAddConstraint: (table: Table, constraintType: string) => void;
  onFixValidation: (issue: string) => void;
}

const RecommendationPanel: React.FC<RecommendationPanelProps> = ({
  tables,
  entities,
  relationships,
  conceptualRelationships,
  schemaMode,
  onCreateJunctionTable,
  onAddConstraint,
  onFixValidation
}) => {
  const [recommendations, setRecommendations] = React.useState<any[]>([]);
  const [validationIssues, setValidationIssues] = React.useState<any[]>([]);

  React.useEffect(() => {
    analyzeSchema();
  }, [tables, entities, relationships, conceptualRelationships, schemaMode]);

  const analyzeSchema = () => {
    const newRecommendations: any[] = [];
    const newValidationIssues: any[] = [];

    // Анализ в зависимости от режима
    if (schemaMode === 'LOGICAL') {
      // 1. Проверка связей N:M без промежуточных таблиц
      const nmRelationships = relationships.filter(rel => rel.cardinality === 'N:M');
      nmRelationships.forEach(rel => {
        const sourceTable = tables.find(t => t.id === rel.sourceTableId);
        const targetTable = tables.find(t => t.id === rel.targetTableId);
        
        if (sourceTable && targetTable) {
          newRecommendations.push({
            id: `rec-nm-${rel.id}`,
            type: 'n_m_relationship',
            title: 'Связь многие-ко-многим обнаружена',
            description: `Связь между "${sourceTable.name}" и "${targetTable.name}" имеет мощность N:M. Рекомендуется создать промежуточную таблицу.`,
            severity: 'high',
            action: () => onCreateJunctionTable(sourceTable, targetTable),
            actionLabel: 'Создать промежуточную таблицу'
          });
        }
      });

      // 2. Проверка таблиц без первичных ключей
      tables.forEach(table => {
        const hasPrimaryKey = table.columns.some(col => col.primaryKey);
        if (!hasPrimaryKey) {
          newValidationIssues.push({
            id: `val-nopk-${table.id}`,
            type: 'no_primary_key',
            title: 'Таблица без первичного ключа',
            description: `Таблица "${table.name}" не имеет первичного ключа.`,
            severity: 'high',
            action: () => onAddConstraint(table, 'PRIMARY_KEY'),
            actionLabel: 'Добавить первичный ключ'
          });
        }
      });

      // 3. Проверка уникальности имен колонок в таблицах
      tables.forEach(table => {
        const columnNames = table.columns.map(col => col.name.toLowerCase());
        const duplicateColumns = columnNames.filter((name, index) => columnNames.indexOf(name) !== index);
        
        if (duplicateColumns.length > 0) {
          newValidationIssues.push({
            id: `val-dupcol-${table.id}`,
            type: 'duplicate_columns',
            title: 'Дублирующиеся имена колонок',
            description: `В таблице "${table.name}" найдены колонки с одинаковыми именами.`,
            severity: 'medium',
            action: () => onFixValidation(`rename_duplicate_columns_${table.id}`),
            actionLabel: 'Исправить'
          });
        }
      });

      // 4. Проверка на внешние ключи без индексов
      relationships.forEach(rel => {
        const sourceTable = tables.find(t => t.id === rel.sourceTableId);
        if (sourceTable) {
          const fkColumn = sourceTable.columns.find(col => col.id === rel.sourceColumnId);
          if (fkColumn && !fkColumn.unique) {
            newRecommendations.push({
              id: `rec-index-${rel.id}`,
              type: 'missing_index',
              title: 'Внешний ключ без индекса',
              description: `Колонка "${fkColumn.name}" в таблице "${sourceTable.name}" используется как внешний ключ, но не имеет индекса.`,
              severity: 'medium',
              action: () => onAddConstraint(sourceTable, 'INDEX'),
              actionLabel: 'Добавить индекс'
            });
          }
        }
      });

      // 5. Проверка на длинные текстовые поля без ограничений
      tables.forEach(table => {
        const longTextColumns = table.columns.filter(col => 
          col.type === 'TEXT' && !col.name.includes('length') && !col.name.includes('size')
        );
        
        if (longTextColumns.length > 0) {
          newRecommendations.push({
            id: `rec-textlen-${table.id}`,
            type: 'text_length',
            title: 'Текстовые поля без ограничения длины',
            description: `В таблице "${table.name}" есть текстовые поля без указания максимальной длины.`,
            severity: 'low',
            action: () => onAddConstraint(table, 'CHECK_LENGTH'),
            actionLabel: 'Добавить ограничения'
          });
        }
      });

    } else {
      // Концептуальная схема
      // 1. Проверка сущностей без первичных ключей
      entities.forEach(entity => {
        const hasPrimaryKey = entity.attributes.some(attr => attr.type === 'PRIMARY');
        if (!hasPrimaryKey) {
          newValidationIssues.push({
            id: `conc-nopk-${entity.id}`,
            type: 'no_primary_key',
            title: 'Сущность без первичного ключа',
            description: `Сущность "${entity.name}" не имеет первичного ключа.`,
            severity: 'high',
            action: () => onFixValidation(`add_primary_key_${entity.id}`),
            actionLabel: 'Добавить первичный ключ'
          });
        }
      });

      // 2. Проверка связей N:M
      const nmConceptualRelationships = conceptualRelationships.filter(rel => rel.cardinality === 'N:M');
      nmConceptualRelationships.forEach(rel => {
        const sourceEntity = entities.find(e => e.id === rel.sourceEntityId);
        const targetEntity = entities.find(e => e.id === rel.targetEntityId);
        
        if (sourceEntity && targetEntity) {
          newRecommendations.push({
            id: `conc-nm-${rel.id}`,
            type: 'n_m_relationship',
            title: 'Связь многие-ко-многим в концептуальной схеме',
            description: `Связь между "${sourceEntity.name}" и "${targetEntity.name}" имеет мощность N:M. При преобразовании в логическую схему потребуется промежуточная таблица.`,
            severity: 'info',
            action: null,
            actionLabel: 'Пометить для преобразования'
          });
        }
      });
    }

    setRecommendations(newRecommendations);
    setValidationIssues(newValidationIssues);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'info';
      case 'info': return 'secondary';
      default: return 'secondary';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      case 'info': return 'ℹ️';
      default: return 'ℹ️';
    }
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'no_primary_key': return '🔑';
      case 'duplicate_columns': return '📄';
      case 'n_m_relationship': return '🔗';
      case 'missing_index': return '📊';
      case 'text_length': return '📝';
      default: return '📌';
    }
  };

  return (
    <div className="recommendation-panel">
      <div className="panel-header">
        <h5>Рекомендации и проверка</h5>
        <small className="text-muted">
          {recommendations.length} рекомендаций, {validationIssues.length} проблем
        </small>
      </div>

      {validationIssues.length > 0 && (
        <div className="validation-section mb-3">
          <h6 className="text-danger mb-2">⚠️ Проблемы валидации</h6>
          <div className="list-group">
            {validationIssues.map(issue => (
              <div key={issue.id} className={`list-group-item list-group-item-action list-group-item-${getSeverityColor(issue.severity)}`}>
                <div className="d-flex w-100 justify-content-between">
                  <h6 className="mb-1">
                    {getIssueIcon(issue.type)} {issue.title}
                  </h6>
                  <small>{getSeverityIcon(issue.severity)}</small>
                </div>
                <p className="mb-1 small">{issue.description}</p>
                {issue.action && (
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={issue.action}
                    className="mt-2"
                  >
                    {issue.actionLabel}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="recommendations-section">
          <h6 className="text-primary mb-2">💡 Рекомендации по улучшению</h6>
          <div className="list-group">
            {recommendations.map(rec => (
              <div key={rec.id} className={`list-group-item list-group-item-action list-group-item-${getSeverityColor(rec.severity)}`}>
                <div className="d-flex w-100 justify-content-between">
                  <h6 className="mb-1">
                    {getIssueIcon(rec.type)} {rec.title}
                  </h6>
                  <small>{getSeverityIcon(rec.severity)}</small>
                </div>
                <p className="mb-1 small">{rec.description}</p>
                {rec.action && (
                  <Button
                    variant="outline-success"
                    size="sm"
                    onClick={rec.action}
                    className="mt-2"
                  >
                    {rec.actionLabel}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations.length === 0 && validationIssues.length === 0 && (
        <div className="text-center text-muted p-3">
          <div className="mb-2">✅</div>
          <small>Нет рекомендаций или проблем валидации</small>
          <p className="mt-2" style={{ fontSize: '11px' }}>
            Схема соответствует лучшим практикам
          </p>
        </div>
      )}

      <div className="mt-3 pt-3 border-top">
        <small className="text-muted">
          <strong>Обозначения:</strong><br/>
          🔴 Высокая важность 🟡 Средняя 🟢 Низкая ℹ️ Информация<br/>
          🔑 Первичный ключ 📄 Колонки 🔗 Связь 📊 Индекс 📝 Текст
        </small>
      </div>
    </div>
  );
};

export default RecommendationPanel;