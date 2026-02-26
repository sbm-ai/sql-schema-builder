import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button, Dropdown, Form } from 'react-bootstrap';
import TableNode from './components/TableNode';
import TableModal from './components/TableModal';
import RelationshipModal from './components/RelationshipModal';
import EntityNode from './components/EntityNode';
import EntityModal from './components/EntityModal';
import RecommendationPanel from './components/RecommendationPanel';
import { SQLGenerator } from './sqlGenerator';
import { Table, Relationship, SQLDialect, SchemaMode, Entity, ConceptualRelationship } from './types';

const nodeTypes = {
  tableNode: TableNode,
  entityNode: EntityNode,
};

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showTableModal, setShowTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState<Relationship | null>(null);
  const [sqlDialect, setSqlDialect] = useState<SQLDialect>('ACCESS');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Conceptual mode state
  const [schemaMode, setSchemaMode] = useState<SchemaMode>('LOGICAL');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [conceptualRelationships, setConceptualRelationships] = useState<ConceptualRelationship[]>([]);

  // Entity modal state
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);

  // Recommendation panel state
  const [showRecommendations, setShowRecommendations] = useState(false);

  // Ref для хранения актуальных nodes
  const nodesRef = useRef<Node[]>([]);
  
  // Обновляем ref при изменении nodes
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const sqlGenerator = new SQLGenerator(sqlDialect);

  // Apply dark mode
  useEffect(() => {
    document.body.classList.toggle('theme-dark', isDarkMode);
  }, [isDarkMode]);

  // Обновляем узлы с информацией о наличии связей
  useEffect(() => {
    setNodes(nds => nds.map((n: Node) => {
      if (n.type !== 'tableNode') return n;
      
      const hasRelationships = relationships.some(
        r => r.sourceTableId === n.id || r.targetTableId === n.id
      );
      
      if (n.data.hasRelationships !== hasRelationships) {
        return {
          ...n, 
          data: { ...n.data, hasRelationships }
        };
      }
      return n;
    }));
  }, [relationships, setNodes]);

  // Проверяем наличие рекомендаций высокой важности
  const hasHighPriorityRecommendations = React.useMemo(() => {
    const tableNodes = nodes.filter((n: Node) => n.type === 'tableNode');
    const tables = tableNodes.map((n: Node) => n.data as Table);
    
    // Проверяем только для 1:1, 1:N, N:1 связей (не M:N - они обрабатываются через junction)
    const nonMNRelationships = relationships.filter(r => r.cardinality !== 'N:M');
    
    for (const table of tables) {
      // Проверка наличия первичного ключа
      const hasPK = table.columns.some(c => c.primaryKey);
      if (!hasPK) return true; // Нет первичного ключа - высокая важность
      
      // Проверяем связи только для не-M:N
      for (const rel of nonMNRelationships) {
        if (rel.sourceTableId === table.id || rel.targetTableId === table.id) {
          // Находим связанную таблицу
          const otherTableId = rel.sourceTableId === table.id ? rel.targetTableId : rel.sourceTableId;
          const otherTable = tables.find(t => t.id === otherTableId);
          if (!otherTable) continue;
          
          // Находим имя связанной колонки из relationship
          const relatedColumnId = rel.sourceTableId === table.id ? rel.sourceColumnId : rel.targetColumnId;
          
          // Проверяем, есть ли FK с таким именем в таблице
          const hasFK = table.columns.some(c => c.id === relatedColumnId);
          if (!hasFK) return true; // Нет FK для связи - высокая важность
        }
      }
    }
    return false;
  }, [nodes, relationships]);

  const onConnect = useCallback((params: Connection) => {
    // Создаём ЕДИНЫЙ ID для edge и relationship
    const newId = `rel-${Date.now()}`;
    
    // Определяем направление связи (кто "один", кто "многий")
    // По умолчанию source - это "один", target - "многий"
    const isSourceOne = true; // source - сторона "один"
    
    // Находим таблицы и их первичные ключи
    const sourceNode = nodes.find((n: Node) => n.id === params.source);
    const targetNode = nodes.find((n: Node) => n.id === params.target);
    
    if (sourceNode && targetNode) {
      const sourceTable = sourceNode.data as Table;
      const targetTable = targetNode.data as Table;
      
      // Находим PK в исходной таблице (сторона "один")
      const sourcePK = sourceTable.columns.find(col => col.primaryKey);
      
      // АВТОМАТИЧЕСКИ добавляем FK на стороне "многий" (target)
      if (sourcePK && isSourceOne) {
        const fkColumnName = `${sourceTable.name}_${sourcePK.name}`;
        
        // Проверяем, нет ли уже такой колонки
        const existingFK = targetTable.columns.find(col => col.name === fkColumnName);
        
        if (!existingFK) {
          // Добавляем FK колонку
          const fkColumn = {
            id: `col-${Date.now()}-fk`,
            name: fkColumnName,
            type: sourcePK.type, // Тот же тип, что и PK
            primaryKey: false,
            nullable: true, // Может быть null в зависимости от обязательности
            unique: false,
            autoIncrement: false,
            isForeignKey: true,
            referencesTable: sourceTable.name,
            referencesColumn: sourcePK.name
          };
          
          // Обновляем целевую таблицу с новой колонкой FK
          setNodes((nds) => nds.map((n: Node) => 
            n.id === params.target 
              ? { 
                  ...n,
                  data: {
                    ...targetTable,
                    columns: [...targetTable.columns, fkColumn],
                    onEditTable: editTableById,
                    onDeleteTable: deleteTableById
                  }
                } 
              : n
          ));
        }
      }
    }
    
    const newEdge = {
      ...params,
      id: newId,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#1976d2', strokeWidth: 2 },
      label: '1:N',
      labelStyle: { fill: '#1976d2', fontWeight: 600, fontSize: 12 },
      labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
    };
    setEdges((eds) => addEdge(newEdge, eds));
    
    // Create relationship record с ТЕМ ЖЕ ID
    const newRelationship: Relationship = {
      id: newId,
      sourceTableId: params.source!,
      sourceColumnId: params.sourceHandle!,
      targetTableId: params.target!,
      targetColumnId: params.targetHandle!,
      cardinality: '1:N',
      sourceOptional: false,
      targetOptional: false,
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    };
    setRelationships((rels) => [...rels, newRelationship]);
  }, [setEdges, nodes]);
    
  const handleAddTable = () => {
    // Создаем новую таблицу только если нет редактируемой
    const newTable: Table = {
      id: `table-${Date.now()}`,
      name: 'Новая таблица',
      columns: [
        {
          id: `col-${Date.now()}`,
          name: 'id',
          type: 'INTEGER',
          primaryKey: true,
          nullable: false,
          unique: true,
          autoIncrement: false
        }
      ],
      x: 100,
      y: 100
    };
    console.log('Opening modal for new table');
    setEditingTable(newTable);
    setShowTableModal(true);
  };

  const handleAddEntity = () => {
    // Создаем новую сущность с одним атрибутом по умолчанию
    const newEntity: Entity = {
      id: `entity-${Date.now()}`,
      name: '',
      attributes: [
        {
          id: `attr-${Date.now()}`,
          name: 'id',
          type: 'PRIMARY'
        }
      ],
      x: 100,
      y: 100
    };
    setEditingEntity(newEntity);
    setShowEntityModal(true);
  };

  // Функции для редактирования и удаления сущностей - используют nodesRef
  const editEntityById = React.useCallback((entityId: string) => {
    const node = nodesRef.current.find((n) => n.id === entityId);
    if (node && node.data) {
      const entityData = node.data as Entity;
      setEditingEntity(entityData);
      setShowEntityModal(true);
    }
  }, []);

  const deleteEntityById = React.useCallback((entityId: string) => {
    if (confirm('Удалить сущность?')) {
      setNodes((nds) => nds.filter((n) => n.id !== entityId));
    }
  }, [setNodes]);

  const handleEditEntity = useCallback((entityId: string) => {
    const node = nodes.find((n) => n.id === entityId && n.type === 'entityNode');
    if (node) {
      setEditingEntity(node.data as Entity);
      setShowEntityModal(true);
    }
  }, [nodes]);

  const handleDeleteEntity = useCallback((entityId: string) => {
    if (confirm('Удалить сущность?')) {
      setNodes((nds) => nds.filter((n) => n.id !== entityId));
    }
  }, [setNodes]);

  const handleEditTable = useCallback((tableId: string) => {
    const node = nodes.find((n: Node) => n.id === tableId);
    if (node) {
      setEditingTable(node.data as Table);
      setShowTableModal(true);
    }
  }, [nodes]);

  const handleDeleteTable = useCallback((tableId: string) => {
    setNodes((nds) => nds.filter((n: Node) => n.id !== tableId));
    setEdges((eds) => eds.filter((e: Edge) => 
      e.source !== tableId && e.target !== tableId
    ));
    setRelationships((rels) => rels.filter((r: Relationship) => 
      r.sourceTableId !== tableId && r.targetTableId !== tableId
    ));
  }, [setNodes, setEdges]);

  // Упрощенные refs - без лишних useEffect
    
  // Convert entities to nodes in conceptual mode - УПРОЩЕННАЯ ВЕРСИЯ
  // Убран useEffect с filter - он может вызывать проблемы
    
  // Update edges when relationships change
  useEffect(() => {
    const updatedEdges = edges.map(edge => {
      const rel = relationships.find(r => r.id === edge.id);
      if (rel) {
        const sourceLabel = rel.sourceOptional ? '0..' : '';
        const targetLabel = rel.targetOptional ? '0..' : '';
        
        let labelText = '';
        switch (rel.cardinality) {
          case '1:1':
            labelText = `${sourceLabel}1 : ${targetLabel}1`;
            break;
          case '1:N':
            labelText = `${sourceLabel}1 : ${targetLabel}N`;
            break;
          case 'N:1':
            labelText = `${sourceLabel}N : ${targetLabel}1`;
            break;
          case 'N:M':
            labelText = `${sourceLabel}N : ${targetLabel}M`;
            break;
        }

        return {
          ...edge,
          label: labelText,
          labelStyle: { fill: '#1976d2', fontWeight: 600, fontSize: 12 },
          labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
        };
      }
      return edge;
    });

    // Only update if there are actual changes
    const hasChanges = JSON.stringify(updatedEdges) !== JSON.stringify(edges);
    if (hasChanges) {
      setEdges(updatedEdges);
    }
  }, [relationships]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    console.log('Edge clicked:', edge.id, 'relationships:', relationships.length);
    const rel = relationships.find(r => r.id === edge.id);
    if (rel) {
      setEditingRelationship(rel);
      setShowRelationshipModal(true);
    }
  }, [relationships]);

  const handleSaveRelationship = (updatedRel: Relationship) => {
    setRelationships((rels) => rels.map((r) => 
      r.id === updatedRel.id ? updatedRel : r
    ));
    setShowRelationshipModal(false);
    setEditingRelationship(null);
  };

  const handleDeleteRelationship = (relId: string) => {
    setRelationships((rels) => rels.filter((r) => r.id !== relId));
    setEdges((eds) => eds.filter((e) => e.id !== relId));
    setShowRelationshipModal(false);
    setEditingRelationship(null);
  };

  // Функция для редактирования таблицы - использует nodesRef для актуальных данных
  const editTableById = React.useCallback((tableId: string) => {
    const node = nodesRef.current.find((n) => n.id === tableId);
    if (node && node.data) {
      const tableData = node.data as Table;
      setEditingTable(tableData);
      setShowTableModal(true);
    }
  }, []);

  // Функция для удаления таблицы
  const deleteTableById = React.useCallback((tableId: string) => {
    if (confirm('Удалить таблицу?')) {
      setNodes((nds) => nds.filter((n) => n.id !== tableId));
      setEdges((eds) => eds.filter((e) => e.source !== tableId && e.target !== tableId));
      setRelationships((rels) => rels.filter((r) => r.sourceTableId !== tableId && r.targetTableId !== tableId));
    }
  }, [setNodes, setEdges, setRelationships]);

  const handleSaveTable = (table: Table) => {
    const existingNode = nodes.find((n) => n.id === table.id);
    
    if (existingNode) {
      // Обновляем существующий - сохраняем позицию
      setNodes((nds) => nds.map((n) => 
        n.id === table.id ? { 
          ...n, 
          data: {
            ...table, 
            onEditTable: editTableById, 
            onDeleteTable: deleteTableById 
          }
        } : n
      ));
    } else {
      // Добавляем новый с вычислением позиции
      const tableCount = nodes.filter(n => n.type === 'tableNode').length;
      const newNode: Node = {
        id: table.id,
        type: 'tableNode',
        position: { x: 100 + (tableCount % 3) * 250, y: 100 + Math.floor(tableCount / 3) * 200 },
        data: {
          ...table,
          onEditTable: editTableById,
          onDeleteTable: deleteTableById
        }
      };
      setNodes((nds) => [...nds, newNode]);
    }
    
    setShowTableModal(false);
    setEditingTable(null);
  };

  const handleSaveEntity = (entity: Entity) => {
    const nodeData = {
      ...entity,
      notation: 'CHEN',
      onEditEntity: editEntityById,
      onDeleteEntity: deleteEntityById
    };
    
    const existingNode = nodes.find((n) => n.id === entity.id);
    
    if (existingNode) {
      // Обновляем существующий
      setNodes((nds) => nds.map((n) => 
        n.id === entity.id ? { ...n, data: nodeData } : n
      ));
    } else {
      // Добавляем новый
      const entityCount = nodes.filter(n => n.type === 'entityNode').length;
      const newNode: Node = {
        id: entity.id,
        type: 'entityNode',
        position: { x: 100 + (entityCount % 3) * 250, y: 100 + Math.floor(entityCount / 3) * 200 },
        data: nodeData
      };
      
      setNodes((nds) => [...nds, newNode]);
    }
    
    setShowEntityModal(false);
    setEditingEntity(null);
  };

  const handleExportSQL = () => {
    const tableNodes = nodes.filter((n: Node) => n.type === 'tableNode');
    const schema = {
      tables: tableNodes.map((n: Node) => n.data as Table),
      relationships
    };
    sqlGenerator.exportToFile(schema, 'schema.sql');
  };

  const handleExportJSON = () => {
    const tableNodes = nodes.filter((n: Node) => n.type === 'tableNode');
    const data = {
      nodes: tableNodes,
      edges,
      relationships,
      sqlDialect
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Экспорт в Markdown для документации
  const handleExportMarkdown = () => {
    const tableNodes = nodes.filter((n: Node) => n.type === 'tableNode');
    const tables = tableNodes.map((n: Node) => n.data as Table);
    
    let md = `# База данных SQL Schema\n\n`;
    md += `## Таблицы\n\n`;
    
    tables.forEach((table: Table) => {
      md += `### ${table.name}\n\n`;
      md += `| Колонка | Тип | PK | Nullable | Unique |\n`;
      md += `|---------|-----|-----|----------|--------|\n`;
      
      table.columns.forEach((col) => {
        md += `| ${col.name} | ${col.type} | ${col.primaryKey ? '✓' : ''} | ${col.nullable ? '✓' : ''} | ${col.unique ? '✓' : ''} |\n`;
      });
      
      md += `\n`;
    });
    
    // Связи
    if (relationships.length > 0) {
      md += `## Связи\n\n`;
      md += `| Таблица 1 | Таблица 2 | Мощность | ON DELETE | ON UPDATE |\n`;
      md += `|-----------|-----------|----------|-----------|----------|\n`;
      
      relationships.forEach((rel: Relationship) => {
        const sourceTable = tables.find(t => t.id === rel.sourceTableId);
        const targetTable = tables.find(t => t.id === rel.targetTableId);
        if (sourceTable && targetTable) {
          md += `| ${sourceTable.name} | ${targetTable.name} | ${rel.cardinality} | ${rel.onDelete} | ${rel.onUpdate} |\n`;
        }
      });
    }
    
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Экспорт в CSV
  const handleExportCSV = () => {
    const tableNodes = nodes.filter((n: Node) => n.type === 'tableNode');
    const tables = tableNodes.map((n: Node) => n.data as Table);
    
    let csv = 'Таблица,Колонка,Тип,PK,NOT NULL,UNIQUE\n';
    tables.forEach((table: Table) => {
      table.columns.forEach((col) => {
        csv += `"${table.name}","${col.name}","${col.type}",${col.primaryKey},${!col.nullable},${col.unique}\n`;
      });
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tables.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Экспорт в PNG
  const handleExportPNG = async () => {
    const reactFlowElement = document.querySelector('.react-flow');
    if (!reactFlowElement) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(reactFlowElement as HTMLElement, {
        backgroundColor: '#ffffff',
        scale: 2
      });
      
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = schemaMode === 'CONCEPTUAL' ? 'conceptual_schema.png' : 'schema.png';
      a.click();
    } catch (err) {
      console.error('Ошибка экспорта в PNG:', err);
      alert('Не удалось экспортировать в PNG');
    }
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            setNodes(data.nodes || []);
            setEdges(data.edges || []);
            setRelationships(data.relationships || []);
            setSqlDialect(data.sqlDialect || 'ACCESS');
          } catch (e) {
            alert('Ошибка при импорте файла');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleClearAll = () => {
    if (confirm('Очистить всю схему?')) {
      setNodes([]);
      setEdges([]);
      setRelationships([]);
    }
  };

  // Функции для рекомендаций
  const handleCreateJunctionTable = (sourceTable: Table, targetTable: Table) => {
    // Находим первичные ключи в исходных таблицах
    const sourcePK = sourceTable.columns.find(col => col.primaryKey);
    const targetPK = targetTable.columns.find(col => col.primaryKey);
    
    const junctionTableName = `${sourceTable.name}_${targetTable.name}`;
    const newTable: Table = {
      id: `table-${Date.now()}`,
      name: junctionTableName,
      columns: [
        {
          id: `col-${Date.now()}-1`,
          // Используем имя PK из исходной таблицы + имя таблицы
          name: `${sourceTable.name}_${sourcePK?.name || 'id'}`,
          // Используем тип PK из исходной таблицы
          type: sourcePK?.type || 'INTEGER',
          primaryKey: true,
          nullable: false,
          unique: true,
          autoIncrement: false
        },
        {
          id: `col-${Date.now()}-2`,
          // Используем имя PK из целевой таблицы + имя таблицы
          name: `${targetTable.name}_${targetPK?.name || 'id'}`,
          // Используем тип PK из целевой таблицы
          type: targetPK?.type || 'INTEGER',
          primaryKey: true,
          nullable: false,
          unique: true,
          autoIncrement: false
        }
      ],
      x: 300,
      y: 300
    };
    
    const newNode: Node = {
      id: newTable.id,
      type: 'tableNode',
      position: { x: 300, y: 300 },
      data: {
        ...newTable,
        onEditTable: editTableById,
        onDeleteTable: deleteTableById
      }
    };
    
    setNodes((nds) => [...nds, newNode]);
    
    // Создаём связи с новой таблицей
    const relId1 = `rel-${Date.now()}-1`;
    const relId2 = `rel-${Date.now()}-2`;
    
    const edge1 = {
      id: relId1,
      source: sourceTable.id,
      target: newTable.id,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      label: '1:N',
      labelStyle: { fill: '#1976d2', fontWeight: 600, fontSize: 12 },
    };
    
    const edge2 = {
      id: relId2,
      source: targetTable.id,
      target: newTable.id,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      label: '1:N',
      labelStyle: { fill: '#1976d2', fontWeight: 600, fontSize: 12 },
    };
    
    setEdges((eds) => [...eds, edge1, edge2]);
    
    setRelationships((rels) => [
      ...rels,
      {
        id: relId1,
        sourceTableId: sourceTable.id,
        sourceColumnId: sourcePK?.id || sourceTable.columns[0]?.id || '',
        targetTableId: newTable.id,
        targetColumnId: newTable.columns[0].id,
        cardinality: '1:N',
        sourceOptional: false,
        targetOptional: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      {
        id: relId2,
        sourceTableId: targetTable.id,
        sourceColumnId: targetPK?.id || targetTable.columns[0]?.id || '',
        targetTableId: newTable.id,
        targetColumnId: newTable.columns[1].id,
        cardinality: '1:N',
        sourceOptional: false,
        targetOptional: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      }
    ]);
    
    alert(`Создана промежуточная таблица "${junctionTableName}" с колонками:
- ${newTable.columns[0].name} (${newTable.columns[0].type})
- ${newTable.columns[1].name} (${newTable.columns[1].type})`);
  };

  const handleAddConstraint = (table: Table, constraintType: string) => {
    if (constraintType === 'PRIMARY_KEY' && table.columns.length > 0) {
      // Добавляем первичный ключ к первой колонке
      const updatedTable = {
        ...table,
        columns: table.columns.map((col, idx) => ({
          ...col,
          primaryKey: idx === 0,
          nullable: idx !== 0
        }))
      };
      
      setNodes((nds) => nds.map((n) => 
        n.id === table.id ? { ...n, data: { ...updatedTable, onEditTable: editTableById, onDeleteTable: deleteTableById } } : n
      ));
      alert(`Добавлен первичный ключ к таблице "${table.name}"`);
    } else if (constraintType === 'INDEX') {
      alert(`Для таблицы "${table.name}" рекомендуется создать индексы вручную`);
    }
  };

  const handleFixValidation = (issue: string) => {
    if (issue.includes('rename_duplicate_columns')) {
      alert('Переименуйте дублирующиеся колонки вручную');
    } else if (issue.includes('add_primary_key')) {
      alert('Добавьте первичный ключ к сущности');
    }
  };

  const generateSQL = () => {
    // Фильтруем только таблицы (tableNode)
    const tableNodes = nodes.filter((n: Node) => n.type === 'tableNode');
    const schema = {
      tables: tableNodes.map((n: Node) => n.data as Table),
      relationships
    };
    return sqlGenerator.generate(schema);
  };

  // Генерация предпросмотра концептуальной схемы
  const generateConceptualPreview = () => {
    const entityNodes = nodes.filter((n: Node) => n.type === 'entityNode');
    
    if (entityNodes.length === 0) {
      return `╔══════════════════════════════════════╗
║     КОНЦЕПТУАЛЬНАЯ СХЕМА          ║
╠══════════════════════════════════════╣
║                                      ║
║   Сущности пока не созданы          ║
║                                      ║
║   Нажмите "+ Сущность"              ║
║   для добавления первой сущности    ║
║                                      ║
╚══════════════════════════════════════╝`;
    }

    let output = `╔══════════════════════════════════════════════════════╗
║           КОНЦЕПТУАЛЬНАЯ СХЕМА (ER-диаграмма)      ║
╠══════════════════════════════════════════════════════╣
`;

    // Выводим сущности
    output += `\n▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ СУЩНОСТИ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n\n`;
    
    entityNodes.forEach((node, index) => {
      const entity = node.data as any;
      const primaryAttrs = entity.attributes?.filter((a: any) => a.type === 'PRIMARY') || [];
      const normalAttrs = entity.attributes?.filter((a: any) => a.type !== 'PRIMARY') || [];
      
      output += `┌─────────────────────────────────┐\n`;
      output += `│  ${entity.name.toUpperCase().padEnd(27)}│\n`;
      output += `├─────────────────────────────────┤\n`;
      
      // Первичные ключи
      primaryAttrs.forEach((attr: any) => {
        output += `│ 🔑 ${attr.name.padEnd(26)}│\n`;
      });
      
      // Обычные атрибуты
      normalAttrs.forEach((attr: any) => {
        const icon = attr.type === 'MULTIVALUED' ? '📚' : attr.type === 'DERIVED' ? '📐' : '  ';
        output += `│${icon} ${attr.name.padEnd(26)}│\n`;
      });
      
      output += `└─────────────────────────────────┘\n`;
      
      if (index < entityNodes.length - 1) {
        output += `           │\n           ▼\n`;
      }
    });

    // Выводим связи
    const relEdges = edges.filter((e: Edge) => e.label);
    
    if (relEdges.length > 0) {
      output += `\n▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ СВЯЗИ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n\n`;
      
      relEdges.forEach((edge: Edge) => {
        const sourceNode = nodes.find((n: Node) => n.id === edge.source);
        const targetNode = nodes.find((n: Node) => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const sourceEntity = sourceNode.data as any;
          const targetEntity = targetNode.data as any;
          const cardinality = edge.label || '1:N';
          
          output += `┌─────────────────┐     ${cardinality}     ┌─────────────────┐\n`;
          output += `│ ${sourceEntity.name.padEnd(15)}│─────────────│ ${targetEntity.name.padEnd(15)}│\n`;
          output += `└─────────────────┘                 └─────────────────┘\n\n`;
        }
      });
    }

    output += `═══════════════════════════════════════════════════════\n`;
    output += `Всего сущностей: ${entityNodes.length}\n`;
    output += `Всего связей: ${relEdges.length}\n`;
    output += `═══════════════════════════════════════════════════════\n`;
    
    return output;
  };

  const handleDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const type = event.dataTransfer.getData('application/reactflow');
      
      if (!reactFlowInstance) {
        return;
      }

      if (type === 'table') {
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const newTable: Table = {
          id: `table-${Date.now()}`,
          name: 'NewTable',
          columns: [
            {
              id: `col-${Date.now()}`,
              name: 'id',
              type: 'AUTOINCREMENT',
              primaryKey: true,
              nullable: false,
              unique: true,
              autoIncrement: true
            }
          ],
          x: position.x,
          y: position.y
        };

        const newNode: Node = {
          id: newTable.id,
          type: 'tableNode',
          position,
          data: {
            ...newTable,
            onEditTable: editTableById,
            onDeleteTable: deleteTableById
          }
        };

        setNodes((nds) => [...nds, newNode]);
      }
    },
    [reactFlowInstance, setNodes]
  );

  return (
    <div className={`app-container ${isDarkMode ? 'theme-dark' : ''}`}>
      {/* Toolbar */}
      <div className="toolbar">
        <span className="toolbar-title">SQL Schema Builder</span>
        
        {/* Переключатель режимов */}
        <Button
          variant={schemaMode === 'CONCEPTUAL' ? 'warning' : 'outline-light'}
          size="sm"
          onClick={() => {
            if (schemaMode === 'LOGICAL') {
              // Переход Логическая -> Концептуальная
              // Преобразуем таблицы в сущности
              const tableNodes = nodes.filter((n: Node) => n.type === 'tableNode');
              const entityNodes = nodes.filter((n: Node) => n.type === 'entityNode');
              
              // Создаем сущности из таблиц
              const newEntities = tableNodes.map((n: Node) => {
                const table = n.data as Table;
                return {
                  ...n,
                  type: 'entityNode' as const,
                  data: {
                    ...table,
                    attributes: table.columns.map((col) => ({
                      id: col.id,
                      name: col.name,
                      type: col.primaryKey ? 'PRIMARY' as const : 'NORMAL' as const,
                      dataType: col.type // Сохраняем исходный тип данных!
                    })),
                    onEditEntity: editEntityById,
                    onDeleteEntity: deleteEntityById
                  }
                };
              });
              
              // Объединяем с существующими сущностями
              const allNodes = [...entityNodes, ...newEntities];
              setNodes(allNodes);
              setSchemaMode('CONCEPTUAL');
            } else {
              // Переход Концептуальная -> Логическая
              // Преобразуем сущности в таблицы
              const entityNodes = nodes.filter((n: Node) => n.type === 'entityNode');
              const tableNodes = nodes.filter((n: Node) => n.type === 'tableNode');
              
              // Создаем таблицы из сущностей
              const newTables = entityNodes.map((n: Node) => {
                const entity = n.data as any; // any для доступа к dataType
                return {
                  ...n,
                  type: 'tableNode' as const,
                  data: {
                    ...entity,
                    columns: entity.attributes.map((attr: any) => ({
                      id: attr.id,
                      name: attr.name,
                      // Используем сохранённый тип или тип по умолчанию
                      type: attr.dataType || (attr.type === 'PRIMARY' ? 'INTEGER' : 'TEXT'),
                      primaryKey: attr.type === 'PRIMARY',
                      nullable: attr.type !== 'PRIMARY',
                      unique: attr.type === 'PRIMARY',
                      autoIncrement: attr.type === 'PRIMARY'
                    })),
                    onEditTable: editTableById,
                    onDeleteTable: deleteTableById
                  }
                };
              });
              
              // Объединяем с существующими таблицами
              const allNodes = [...tableNodes, ...newTables];
              setNodes(allNodes);
              setSchemaMode('LOGICAL');
            }
          }}
        >
          {schemaMode === 'CONCEPTUAL' ? '📊 Концептуальная' : '📋 Логическая'}
        </Button>
        
        {schemaMode === 'LOGICAL' ? (
          <Button variant="outline-light" size="sm" onClick={handleAddTable}>
            + Таблица
          </Button>
        ) : (
          <Button variant="outline-light" size="sm" onClick={handleAddEntity}>
            + Сущность
          </Button>
        )}
        
        <Dropdown>
          <Dropdown.Toggle variant="outline-light" size="sm">
            Экспорт
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={handleExportSQL}>SQL (CREATE TABLE)</Dropdown.Item>
            <Dropdown.Item onClick={handleExportJSON}>JSON (полная схема)</Dropdown.Item>
            <Dropdown.Item onClick={handleExportMarkdown}>Markdown (документация)</Dropdown.Item>
            <Dropdown.Item onClick={handleExportCSV}>CSV (таблицы)</Dropdown.Item>
            <Dropdown.Item onClick={handleExportPNG}>PNG (изображение)</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        <Dropdown>
          <Dropdown.Toggle variant="outline-light" size="sm">
            Импорт
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={handleImportJSON}>Импорт JSON</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        <Button variant="outline-light" size="sm" onClick={handleClearAll}>
          Очистить
        </Button>

        <Form.Select
          value={sqlDialect}
          onChange={(e) => setSqlDialect(e.target.value as SQLDialect)}
          size="sm"
          style={{ width: 'auto', minWidth: '120px' }}
        >
          <option value="ACCESS">MS Access</option>
          <option value="SQLITE">SQLite</option>
          <option value="MYSQL">MySQL</option>
          <option value="POSTGRESQL">PostgreSQL</option>
        </Form.Select>

        <Button
          variant={
            hasHighPriorityRecommendations ? 'danger' : 
            showRecommendations ? 'warning' : 'outline-light'
          }
          size="sm"
          onClick={() => setShowRecommendations(!showRecommendations)}
          title={hasHighPriorityRecommendations ? "Есть рекомендации высокой важности!" : "Рекомендации"}
          className={hasHighPriorityRecommendations ? 'recommendation-flash' : ''}
        >
          {hasHighPriorityRecommendations ? '🔴' : showRecommendations ? '💡' : '💡'}
        </Button>

        <Button
          variant="outline-light"
          size="sm"
          onClick={() => setIsDarkMode(!isDarkMode)}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </Button>
      </div>

      <div className="main-content">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="section-title">Инструкция</div>
          {schemaMode === 'CONCEPTUAL' ? (
            <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
              <p><strong>1.</strong> Нажмите "+ Сущность" для создания сущности</p>
              <p><strong>2.</strong> Кликните по заголовку для редактирования</p>
              <p><strong>3.</strong> Добавьте атрибуты (обычные, первичный ключ, многозначные)</p>
              <p><strong>4.</strong> Соедините таблицы для связей</p>
              <p><strong>5.</strong> Кликните по связи для редактирования/удаления</p>
              <p><strong>6.</strong> Экспортируйте в PNG для документации</p>
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
              <p><strong>1.</strong> Нажмите "+ Таблица" для создания таблицы</p>
              <p><strong>2.</strong> Кликните по заголовку для редактирования</p>
              <p><strong>3.</strong> Добавьте колонки и укажите их типы</p>
              <p><strong>4.</strong> Соедините таблицы для связей</p>
              <p><strong>5.</strong> Кликните по связи для редактирования/удаления</p>
              <p><strong>6.</strong> Экспортируйте SQL/JSON/Markdown/CSV/PNG</p>
            </div>
          )}

          <div className="section-title" style={{ marginTop: '20px' }}>
            Статистика
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>
            {schemaMode === 'CONCEPTUAL' ? (
              <>
                <p>Сущностей: {nodes.filter(n => n.type === 'entityNode').length}</p>
                <p>Связей: {edges.length}</p>
              </>
            ) : (
              <>
                <p>Таблиц: {nodes.filter(n => n.type === 'tableNode').length}</p>
                <p>Связей: {edges.length}</p>
              </>
            )}
          </div>

          {schemaMode === 'LOGICAL' && (
            <div className="section-title" style={{ marginTop: '20px' }}>
              Типы данных
            </div>
          )}
          {schemaMode === 'LOGICAL' && (
            <div style={{ fontSize: '11px', color: '#888', lineHeight: '1.4' }}>
              <p>TEXT - текст до 255 символов</p>
              <p>INTEGER - целое число</p>
              <p>LONG - длинное целое</p>
              <p>DOUBLE - число с плавающей точкой</p>
              <p>CURRENCY - денежный формат</p>
              <p>DATETIME - дата и время</p>
              <p>BOOLEAN - логическое значение</p>
              <p>AUTOINCREMENT - автоинкремент</p>
              <p>MEMO - длинный текст</p>
              <p>OLE - OLE объект</p>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="canvas-container" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onEdgeClick={handleEdgeClick}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
          >
            <Background color="#aaa" gap={16} />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* SQL Panel */}
        <div className="sql-panel">
          <div className="sql-panel-header">SQL Предпросмотр</div>
          <div className="sql-panel-content">
            <textarea
              className="sql-preview"
              readOnly
              value={generateSQL()}
            />
          </div>
        </div>

        {/* Recommendation Panel */}
        {showRecommendations && (
          <RecommendationPanel
            tables={nodes.filter((n: Node) => n.type === 'tableNode').map((n: Node) => n.data as Table)}
            entities={nodes.filter((n: Node) => n.type === 'entityNode').map((n: Node) => n.data as Entity)}
            relationships={relationships}
            conceptualRelationships={conceptualRelationships}
            schemaMode={schemaMode}
            onCreateJunctionTable={handleCreateJunctionTable}
            onAddConstraint={handleAddConstraint}
            onFixValidation={handleFixValidation}
          />
        )}
      </div>

      {/* Table Modal */}
      <TableModal
        show={showTableModal}
        table={editingTable}
        onSave={handleSaveTable}
        onClose={() => {
          setShowTableModal(false);
          setEditingTable(null);
        }}
      />

      {/* Relationship Modal */}
      <RelationshipModal
        show={showRelationshipModal}
        relationship={editingRelationship}
        sourceTableName={editingRelationship ? nodes.find(n => n.id === editingRelationship.sourceTableId)?.data?.name || '' : ''}
        targetTableName={editingRelationship ? nodes.find(n => n.id === editingRelationship.targetTableId)?.data?.name || '' : ''}
        onSave={handleSaveRelationship}
        onDelete={handleDeleteRelationship}
        onClose={() => {
          setShowRelationshipModal(false);
          setEditingRelationship(null);
        }}
      />

      {/* Entity Modal */}
      <EntityModal
        show={showEntityModal}
        entity={editingEntity}
        onSave={handleSaveEntity}
        onClose={() => {
          setShowEntityModal(false);
          setEditingEntity(null);
        }}
      />
    </div>
  );
}

export default App;
