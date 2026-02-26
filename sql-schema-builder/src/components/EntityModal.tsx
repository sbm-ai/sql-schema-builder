import React, { useState, useEffect } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import { Entity, Attribute, AttributeType } from '../types';

interface EntityModalProps {
  show: boolean;
  entity: Entity | null;
  onSave: (entity: Entity) => void;
  onClose: () => void;
}

const attributeTypes: AttributeType[] = ['NORMAL', 'PRIMARY', 'MULTIVALUED', 'DERIVED'];

const EntityModal: React.FC<EntityModalProps> = ({ show, entity, onSave, onClose }) => {
  const [entityName, setEntityName] = useState('');
  const [attributes, setAttributes] = useState<Attribute[]>([]);

  useEffect(() => {
    if (entity) {
      setEntityName(entity.name);
      setAttributes([...entity.attributes]);
    } else {
      setEntityName('');
      setAttributes([]);
    }
  }, [entity, show]);

  const handleAddAttribute = () => {
    const newAttribute: Attribute = {
      id: `attr-${Date.now()}`,
      name: '',
      type: 'NORMAL'
    };
    setAttributes([...attributes, newAttribute]);
  };

  const handleAttributeChange = (index: number, field: keyof Attribute, value: any) => {
    const updated = [...attributes];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-set first primary key
    if (field === 'type' && value === 'PRIMARY') {
      const hasPrimary = updated.some((a, i) => a.type === 'PRIMARY' && i !== index);
      if (hasPrimary) {
        alert('Только один атрибут может быть первичным ключом');
        return;
      }
    }
    
    setAttributes(updated);
  };

  const handleDeleteAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!entityName.trim()) {
      alert('Введите название сущности');
      return;
    }

    if (attributes.length === 0) {
      alert('Добавьте хотя бы один атрибут');
      return;
    }

    const hasEmptyName = attributes.some(a => !a.name.trim());
    if (hasEmptyName) {
      alert('Все атрибуты должны иметь названия');
      return;
    }

    const savedEntity: Entity = {
      id: entity?.id || `entity-${Date.now()}`,
      name: entityName.trim(),
      attributes: attributes.map(a => ({ ...a, name: a.name.trim() })),
      x: entity?.x || 100,
      y: entity?.y || 100
    };

    onSave(savedEntity);
  };

  const getAttributeTypeLabel = (type: AttributeType) => {
    switch (type) {
      case 'PRIMARY': return 'Первичный ключ';
      case 'MULTIVALUED': return 'Многозначный';
      case 'DERIVED': return 'Производный';
      default: return 'Обычный';
    }
  };

  return (
    <Modal show={show} onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{entity ? 'Редактировать сущность' : 'Новая сущность'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Название сущности</Form.Label>
          <Form.Control
            type="text"
            value={entityName}
            onChange={(e) => setEntityName(e.target.value)}
            placeholder="Например: Пользователь, Заказ, Товар"
          />
        </Form.Group>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">Атрибуты</h6>
          <Button variant="primary" size="sm" onClick={handleAddAttribute}>
            + Добавить атрибут
          </Button>
        </div>

        {attributes.map((attribute, index) => (
          <div key={attribute.id} className="card mb-2 p-3">
            <div className="row g-2">
              <div className="col-md-5">
                <Form.Control
                  type="text"
                  value={attribute.name}
                  onChange={(e) => handleAttributeChange(index, 'name', e.target.value)}
                  placeholder="Название"
                  size="sm"
                />
              </div>
              <div className="col-md-4">
                <Form.Select
                  value={attribute.type}
                  onChange={(e) => handleAttributeChange(index, 'type', e.target.value)}
                  size="sm"
                >
                  {attributeTypes.map(type => (
                    <option key={type} value={type}>{getAttributeTypeLabel(type)}</option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-3">
                {attributes.length > 1 && (
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => handleDeleteAttribute(index)}
                  >
                    Удалить
                  </Button>
                )}
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
          {entity ? 'Обновить' : 'Добавить'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EntityModal;