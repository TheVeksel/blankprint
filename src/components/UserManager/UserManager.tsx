import { useEffect, useState } from 'react';
import { getAllHunters, addHunter, clearHunters, deleteHunter, updateHunter } from '../../db';
import { useNavigate } from 'react-router-dom';
import ConfigModal from '../ConfigModal/ConfigModal';
import { getConfig } from '../../utils/config';
import './UserManager.scss';

interface HunterForm {
  id?: number;
  fullName: string;
  series: string;
  number: string;
  issueDate: string;
  issuedBy?: string;
}

const sortByFullName = (list: HunterForm[]) =>
  list.slice().sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru', { sensitivity: 'base' }));

const UserManager = () => {
  const [hunters, setHunters] = useState<HunterForm[]>([]);
  const [form, setForm] = useState<HunterForm>({ fullName: '', series: '', number: '', issueDate: '' });
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const navigate = useNavigate();

  const loadHunters = async () => {
    const all = await getAllHunters();
    setHunters(sortByFullName(all));
  };

  useEffect(() => { loadHunters(); }, []);

  useEffect(() => {
    const cfg = getConfig();
    setForm((f) => ({ ...f, issuedBy: cfg.issuedByName || '' }));
  }, []);

  const handleAdd = async () => {
    const { fullName, series, number, issueDate } = form;
    if (!fullName || !series || !number || !issueDate) {
      alert('Заполни все поля');
      return;
    }
    await addHunter(form);
    setForm({ fullName: '', series: '', number: '', issueDate: '' });
    await loadHunters();
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Удалить этого пользователя?')) {
      await deleteHunter(id);
      if (editingId === id) setEditingId(null);
      await loadHunters();
    }
  };

  const handleClear = async () => {
    if (window.confirm('Удалить всех пользователей?')) {
      await clearHunters();
      setEditingId(null);
      await loadHunters();
    }
  };

  const handleEditChange = (id: number, key: keyof HunterForm, value: string) => {
    setHunters(prev => prev.map(h => (h.id === id ? { ...h, [key]: value } : h)));
  };

  const handleSave = async (hunter: HunterForm) => {
    await updateHunter(hunter);
    setEditingId(null);
    await loadHunters();
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(hunters, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hunters_backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data: HunterForm[] = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('Неверный формат файла');
      await clearHunters();
      for (const hunter of data) {
        // Удаляем id, чтобы IndexedDB сгенерировал новый (если в файле они есть)
        const { id, ...rest } = hunter as any;
        await addHunter(rest as HunterForm);
      }
      await loadHunters();
      alert('Импорт завершён успешно');
    } catch (err) {
      alert('Ошибка импорта: ' + (err as Error).message);
    } finally {
      // Сброс input'а чтобы можно было импортировать тот же файл снова
      (e.target as HTMLInputElement).value = '';
    }
  };

  const filtered = hunters.filter(h => {
    const query = search.toLowerCase();
    const ticket = `${h.series}№${h.number}`.toLowerCase();
    const date = new Date(h.issueDate).toLocaleDateString('ru-RU');
    return h.fullName.toLowerCase().includes(query) || ticket.includes(query) || date.includes(query);
  });

  return (
    <div className="user-manager">
      <h1>Управление охотниками</h1>

      <div className="controls">
        <input
          type="text"
          placeholder="ФИО"
          value={form.fullName}
          onChange={e => setForm({ ...form, fullName: e.target.value })}
        />
        <input
          type="text"
          placeholder="Серия"
          value={form.series}
          onChange={e => setForm({ ...form, series: e.target.value })}
        />
        <input
          type="text"
          placeholder="Номер"
          value={form.number}
          onChange={e => setForm({ ...form, number: e.target.value })}
        />
        <input
          type="date"
          value={form.issueDate}
          onChange={e => setForm({ ...form, issueDate: e.target.value })}
        />
        <button onClick={handleAdd}>Добавить</button>
        <button className="danger" onClick={handleClear}>Очистить всё</button>
        <button className="config-btn" onClick={() => setShowConfig(true)}>Настройки печати</button>
      </div>

      {showConfig && <ConfigModal onClose={() => { setShowConfig(false); loadHunters(); }} />}

      <div className="actions">
        <input
          type="text"
          placeholder="Поиск по ФИО, номеру или дате выдачи..."
          className="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="import-export">
          <button onClick={handleExport}>📤 Экспорт JSON</button>
          <label className="import-label">
            📥 Импорт JSON
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      <ul className="user-list">
        {filtered.map(h => (
          <li key={h.id}>
            {editingId === h.id ? (
              <div className="inline-edit">
                <input
                  type="text"
                  value={h.fullName}
                  onChange={e => handleEditChange(h.id!, 'fullName', e.target.value)}
                />
                <input
                  type="text"
                  value={h.series}
                  onChange={e => handleEditChange(h.id!, 'series', e.target.value)}
                />
                <input
                  type="text"
                  value={h.number}
                  onChange={e => handleEditChange(h.id!, 'number', e.target.value)}
                />
                <input
                  type="date"
                  value={h.issueDate}
                  onChange={e => handleEditChange(h.id!, 'issueDate', e.target.value)}
                />
                <div className="edit-actions">
                  <button className="save" onClick={() => handleSave(h)}>💾</button>
                  <button className="cancel" onClick={() => setEditingId(null)}>✖</button>
                </div>
              </div>
            ) : (
              <div className="info" onClick={() => navigate(`/print/${h.id}`)}>
                <strong>{h.fullName}</strong>
                <div className="ticket">{h.series} №{h.number}</div>
                <div className="date">Выдан: {new Date(h.issueDate).toLocaleDateString()}</div>
                <button onClick={(e) => { e.stopPropagation(); setEditingId(h.id!); }}>✎</button>
              </div>
            )}
            <button
              className="delete"
              onClick={e => { e.stopPropagation(); handleDelete(h.id!); }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UserManager;
