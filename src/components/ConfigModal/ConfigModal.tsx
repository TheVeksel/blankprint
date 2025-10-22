// src/components/ConfigModal/ConfigModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import './ConfigModal.scss';
import { getConfig, setConfig, type PrintConfig } from '../../utils/config';

export interface SavedGroup {
  id: string;
  name: string;
  animals: string[]; // ['Гусь','Утка', ...]
  dateFrom: string; // 'YYYY-MM-DD'
  dateTo: string;   // 'YYYY-MM-DD'
  dailyLimit: string;
  seasonLimit: string;
  blankType: 'Yellow' | 'Pink' | 'Blue';
}

export const configFields: { key: keyof PrintConfig; label: string }[] = [
  { key: 'organizationName', label: 'Наименование организации' },
  { key: 'huntingPlace', label: 'Место охоты' },
  { key: 'issuedByName', label: 'ФИО выдавшего' },
  { key: 'huntType', label: 'Тип охоты' },
];

interface ConfigModalProps {
  onClose: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 9);

const isSavedGroupArray = (v: any): v is SavedGroup[] => {
  if (!Array.isArray(v)) return false;
  return v.every(item =>
    item && typeof item === 'object' &&
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    Array.isArray(item.animals) &&
    typeof item.dateFrom === 'string' &&
    typeof item.dateTo === 'string'
  );
};

const ConfigModal: React.FC<ConfigModalProps> = ({ onClose }) => {
  // load raw config (may contain savedGroups)
  const raw = getConfig() as PrintConfig & { savedGroups?: SavedGroup[] };
  const savedGroupsInitial = raw.savedGroups || [];

  const { register, handleSubmit, reset } = useForm<PrintConfig>({
    defaultValues: raw,
  });

  const [groups, setGroups] = useState<SavedGroup[]>(savedGroupsInitial);

  // group form state
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editing, setEditing] = useState<SavedGroup | null>(null);
  const [gName, setGName] = useState('');
  const [gAnimalsText, setGAnimalsText] = useState(''); // CSV
  const [gDateFrom, setGDateFrom] = useState('2025-09-15');
  const [gDateTo, setGDateTo] = useState('2026-02-28');
  const [gDailyLimit, setGDailyLimit] = useState('б/о');
  const [gSeasonLimit, setGSeasonLimit] = useState('б/о');
  const [gBlankType, setGBlankType] = useState<'Yellow'|'Pink'|'Blue'>('Yellow');

  // menu (three dots) state & file input ref
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // initialize form + groups
    reset(raw);
    setGroups(savedGroupsInitial);
    // close menu on outside click
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!(e.target as Node) || menuRef.current.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistConfig = (cfg: PrintConfig & { savedGroups?: SavedGroup[] }) => {
    setConfig(cfg);
  };

  const onSubmit = (data: PrintConfig) => {
    // save cfg + groups
    const merged = { ...data, savedGroups: groups };
    persistConfig(merged);
    onClose();
  };

  const saveGroup = () => {
    const animals = gAnimalsText
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!gName.trim()) {
      alert('Укажите имя группы');
      return;
    }
    if (animals.length === 0) {
      alert('Добавьте хотя бы одно животное (через запятую)');
      return;
    }

    if (editing) {
      const updated: SavedGroup = {
        ...editing,
        name: gName.trim(),
        animals,
        dateFrom: gDateFrom,
        dateTo: gDateTo,
        dailyLimit: gDailyLimit,
        seasonLimit: gSeasonLimit,
        blankType: gBlankType,
      };
      const newGroups = groups.map((g) => (g.id === editing.id ? updated : g));
      setGroups(newGroups);
    } else {
      const newGroup: SavedGroup = {
        id: uid(),
        name: gName.trim(),
        animals,
        dateFrom: gDateFrom,
        dateTo: gDateTo,
        dailyLimit: gDailyLimit,
        seasonLimit: gSeasonLimit,
        blankType: gBlankType,
      };
      setGroups([newGroup, ...groups]);
    }

    // reset group form
    setEditing(null);
    setGName('');
    setGAnimalsText('');
    setGDateFrom('2025-09-15');
    setGDateTo('2026-02-28');
    setGDailyLimit('б/о');
    setGSeasonLimit('б/о');
    setGBlankType('Yellow');
    setShowGroupForm(false);
  };

  const editGroup = (g: SavedGroup) => {
    setEditing(g);
    setGName(g.name);
    setGAnimalsText(g.animals.join(', '));
    setGDateFrom(g.dateFrom);
    setGDateTo(g.dateTo);
    setGDailyLimit(g.dailyLimit);
    setGSeasonLimit(g.seasonLimit);
    setGBlankType(g.blankType || 'Yellow');
    setShowGroupForm(true);
  };

  const deleteGroup = (id: string) => {
    if (!confirm('Удалить группу?')) return;
    const newGroups = groups.filter((g) => g.id !== id);
    setGroups(newGroups);
  };

  // Export config -> JSON file
  const handleExport = () => {
    try {
      const cfg = { ...getConfig(), savedGroups: groups };
      const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'print_config.json';
      a.click();
      URL.revokeObjectURL(url);
      setMenuOpen(false);
    } catch (err) {
      console.error(err);
      alert('Ошибка при экспорте конфига');
    }
  };

  // Import config JSON
  const handleImportClick = () => {
    setMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (typeof parsed !== 'object' || parsed === null) throw new Error('Невалидный формат');
        // validate and normalize savedGroups if present
        const merged = { ...getConfig(), ...parsed } as PrintConfig & { savedGroups?: SavedGroup[] };
        if (parsed.savedGroups) {
          if (!isSavedGroupArray(parsed.savedGroups)) {
            throw new Error('savedGroups имеет неверную структуру');
          }
          merged.savedGroups = parsed.savedGroups;
          setGroups(parsed.savedGroups);
        }
        // write config
        persistConfig(merged);
        reset(merged);
        alert('Конфиг импортирован и сохранён');
      } catch (err) {
        console.error(err);
        alert('Не удалось импортировать конфиг: неверный JSON или структура');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      alert('Не удалось прочитать файл');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="config-modal-backdrop" onClick={onClose}>
      <div className="config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="close-btn" onClick={onClose}>×</div>

        {/* меню (три точки) */}
        <div className="menu-wrapper" ref={menuRef}>
          <button
            className="menu-button"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((s) => !s)}
            title="Ещё"
          >
            ⋯
          </button>

          {menuOpen && (
            <div className="menu-dropdown" role="menu">
              <button className="menu-item" onClick={handleExport} role="menuitem">Экспорт конфига (JSON)</button>
              <button className="menu-item" onClick={handleImportClick} role="menuitem">Импорт конфига (JSON)</button>
            </div>
          )}
        </div>

        <h2>Настройки печати</h2>

        <form onSubmit={handleSubmit(onSubmit)}>
          {configFields.map(f => (
            <div className="field" key={String(f.key)}>
              <label>{f.label}:</label>
              <input {...register(f.key)} />
            </div>
          ))}

          <hr />

          <div className="groups-header">
            <h3>Группы ресурсов</h3>
            <div className="groups-actions">
              <button
                type="button"
                onClick={() => { setShowGroupForm((s) => !s); setEditing(null); }}
              >
                {showGroupForm ? 'Закрыть форму' : 'Создать группу'}
              </button>
            </div>
          </div>

          {showGroupForm && (
            <div className="group-form">
              <label>Название группы</label>
              <input value={gName} onChange={(e) => setGName(e.target.value)} />

              <label>Животные (через запятую)</label>
              <textarea value={gAnimalsText} onChange={(e) => setGAnimalsText(e.target.value)} rows={3} />

              <div className="date-row">
                <label>Дата с: <input type="date" value={gDateFrom} onChange={(e) => setGDateFrom(e.target.value)} /></label>
                <label>Дата по: <input type="date" value={gDateTo} onChange={(e) => setGDateTo(e.target.value)} /></label>
              </div>

              <div className="limit-row">
                <label>Норма/день: <input value={gDailyLimit} onChange={(e) => setGDailyLimit(e.target.value)} /></label>
                <label>Норма/сезон: <input value={gSeasonLimit} onChange={(e) => setGSeasonLimit(e.target.value)} /></label>
              </div>

              <div className="limit-row">
                <label>Тип бланка:
                  <select value={gBlankType} onChange={(e) => setGBlankType(e.target.value as any)}>
                    <option value="Yellow">Жёлтый</option>
                    <option value="Pink">Розовый</option>
                    <option value="Blue">Синий</option>
                  </select>
                </label>
              </div>

              <div className="group-form-actions">
                <button type="button" onClick={saveGroup}>{editing ? 'Сохранить изменения' : 'Создать группу'}</button>
                <button type="button" onClick={() => { setShowGroupForm(false); setEditing(null); }}>Отмена</button>
              </div>
            </div>
          )}

          <div className="groups-list">
            {groups.length === 0 ? <div className="muted">Групп ещё нет</div> : groups.map(g => (
              <div className="group-row" key={g.id}>
                <div className="group-info">
                  <strong>{g.name}</strong> — {g.animals.length} шт.
                  <div className="group-meta"> {g.dateFrom} → {g.dateTo} · {g.dailyLimit}/{g.seasonLimit} · <em>{g.blankType}</em></div>
                </div>
                <div className="group-controls">
                  <button type="button" onClick={() => editGroup(g)}>✎</button>
                  <button type="button" onClick={() => deleteGroup(g.id)}>🗑</button>
                </div>
              </div>
            ))}
          </div>

          <div className="buttons">
            <button type="submit" className="save">Сохранить</button>
            <button type="button" className="cancel" onClick={onClose}>Отмена</button>
          </div>
        </form>

        {/* скрытый input для импорта */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};

export default ConfigModal;
