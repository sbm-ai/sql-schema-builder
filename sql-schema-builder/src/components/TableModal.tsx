// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import { Table, Column, DataType } from '../types';

interface TableModalProps {
  show: boolean;
  table: Table | null;
  onSave: (table: Table) => void;
  onClose: () => void;
}

const dataTypes: DataType[] = [
  'TEXT',
  'INTEGER',
  'LONG',
  'DOUBLE',
  'CURRENCY',
  'DATETIME',
  'BOOLEAN',
  'AUTOINCREMENT',
  'MEMO',
  'OLE'
];

const TableModal: React.FC<TableModalProps> = ({ show, table, onSave, onClose }) => {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<Column[]>([]);

  useEffect(() => {
    if (table) {
      setTableName(table.name);
      setColumns([...table.columns]);
    } else {
      setTableName('');
      setColumns([]);
    }
  }, [table, show]);

  const handleAddColumn = () => {
    const newColumn: Column = {
      id: `col-${Date.now()}`,
      name: '',
      type: 'TEXT',
      primaryKey: false,
      nullable: true,
      unique: false,
      autoIncrement: false
    };
    setColumns([...columns, newColumn]);
  };

  const handleColumnChange = (index: number, field: keyof Column, value: any) => {
    const updated = [...columns];
    const col = { ...updated[index] };
    
    // Handle PK checkbox changes
    if (field === 'primaryKey') {
      if (value && col.autoIncrement) {
        // Can't change PK on AUTOINCREMENT - it's always PK
        return;
      }
      col.primaryKey = value;
      if (value) {
        col.nullable = false;
        col.unique = true;
      }
    }
    // Handle type changes
    else if (field === 'type') {
      col.type = value as Column['type'];
      if (value === 'AUTOINCREMENT') {
        col.autoIncrement = true;
        col.primaryKey = true;
        col.nullable = false;
        col.unique = true;
      } else if (col.autoIncrement) {
        col.autoIncrement = false;
      }
    }
    // Handle nullable changes
    else if (field === 'nullable') {
      if (col.primaryKey && value) {
        return;
      }
      col.nullable = value;
    }
    // Handle unique changes
    else if (field === 'unique') {
      col.unique = value;
    }
    // Handle name changes
    else if (field === 'name') {
      col.name = value;
    }
    
    updated[index] = col;
    setColumns(updated);
  };

  const handleDeleteColumn = (index: number) => {
    setColumns(columns.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!tableName.trim()) {
      alert('Введите название таблицы');
      return;
    }

    if (columns.length === 0) {
      alert('Добавьте хотя бы одну колонку');
      return;
    }

    const hasEmptyName = columns.some(c => !c.name.trim());
    if (hasEmptyName) {
      alert('Все колонки должны иметь названия');
      return;
    }

    const savedTable: Table = {
      id: table?.id || `table-${Date.now()}`,
      name: tableName.trim(),
      columns: columns.map(c => ({ ...c, name: c.name.trim() })),
      x: table?.x || 100,
      y: table?.y || 100
    };

    onSave(savedTable);
  };

  return (
    <Modal show={show} onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{table ? 'Редактировать таблицу' : 'Новая таблица'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Название таблицы</Form.Label>
          <Form.Control
            type="text"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="Например: Users, Orders, Products"
          />
        </Form.Group>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">Колонки</h6>
          <Button variant="primary" size="sm" onClick={handleAddColumn}>
            + Добавить колонку
          </Button>
        </div>

        {columns.map((column, index) => (
          <div key={column.id} className="card mb-2 p-3">
            <div className="row g-2">
              <div className="col-md-3">
                <Form.Control
                  type="text"
                  value={column.name}
                  onChange={(e) => handleColumnChange(index, 'name', e.target.value)}
                  placeholder="Название"
                  size="sm"
                />
              </div>
              <div className="col-md-3">
                <Form.Select
                  value={column.type}
                  onChange={(e) => handleColumnChange(index, 'type', e.target.value)}
                  size="sm"
                >
                  {dataTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-6">
                <div className="d-flex gap-2 flex-wrap align-items-center">
                  <Form.Check
                    type="checkbox"
                    label="PK"
                    checked={column.primaryKey}
                    onChange={(e) => handleColumnChange(index, 'primaryKey', e.target.checked)}
                    size="sm"
                    disabled={column.autoIncrement}
                    title={column.autoIncrement ? "AUTOINCREMENT всегда является Primary Key" : ""}
                  />
                  <Form.Check
                    type="checkbox"
                    label="NOT NULL"
                    checked={!column.nullable}
                    onChange={(e) => handleColumnChange(index, 'nullable', !e.target.checked)}
                    size="sm"
                    disabled={column.primaryKey}
                    title={column.primaryKey ? "Primary Key не может быть NULL" : ""}
                  />
                  <Form.Check
                    type="checkbox"
                    label="UNIQUE"
                    checked={column.unique}
                    onChange={(e) => handleColumnChange(index, 'unique', e.target.checked)}
                    size="sm"
                  />
                  {column.autoIncrement && (
                    <span className="badge bg-info text-dark">AUTO</span>
                  )}
                  {columns.length > 1 && (
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDeleteColumn(index)}
                    >
                      Удалить
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Сохранить
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TableModal;
