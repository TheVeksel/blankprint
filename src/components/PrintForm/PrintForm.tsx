// src/components/PrintForm/PrintForm.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { getAllHunters } from '../../db';
import { generatePdf } from './usePrint';
import { getConfig, type PrintConfig } from '../../utils/config';
import './PrintForm.scss';
import { configFields, type SavedGroup } from '../ConfigModal/ConfigModal';

interface ResourceGroup {
  resource: string;
  dateFrom: string;
  dateTo: string;
  dailyLimit: string;
  seasonLimit: string;
}

export interface PrintFormValues extends PrintConfig {
  resources: ResourceGroup[];
  issueDate: string;
}

const MAX_RESOURCES = 10;

const PrintForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [hunter, setHunter] = useState<any>(null);

  const cfgRaw = getConfig() as PrintConfig & { savedGroups?: SavedGroup[] };
  const savedGroups = cfgRaw.savedGroups || [];

  const { register, control, handleSubmit, reset, setValue } = useForm<PrintFormValues>({
    defaultValues: {
      organizationName: cfgRaw.organizationName || '',
      huntingPlace: cfgRaw.huntingPlace || '',
      issuedByName: cfgRaw.issuedByName || '',
      huntType: (cfgRaw as any).huntType || '',
      resources: [{ resource: '', dateFrom: '', dateTo: '', dailyLimit: '', seasonLimit: '' }],
      issueDate: new Date().toISOString().substring(0, 10),
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'resources',
  });

  // group input state (datalist)
  const [groupInput, setGroupInput] = useState('');

  useEffect(() => {
    getAllHunters().then((list) => {
      const h = list.find((x) => x.id === Number(id));
      if (h) {
        setHunter(h);
        reset((prev) => ({
          ...prev,
          organizationName: cfgRaw.organizationName || '',
          huntingPlace: cfgRaw.huntingPlace || '',
          issuedByName: cfgRaw.issuedByName || '',
          huntType: (cfgRaw as any).huntType || '',
          resources: prev.resources && prev.resources.length ? prev.resources : [{ resource: '', dateFrom: '', dateTo: '', dailyLimit: '', seasonLimit: '' }],
          issueDate: new Date().toISOString().substring(0, 10),
        }));
      } else {
        navigate('/');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, id]);

  const groupToResources = useCallback((g: SavedGroup): ResourceGroup[] => {
    const max = Math.min(g.animals.length, MAX_RESOURCES);
    return g.animals.slice(0, max).map((a) => ({
      resource: a,
      dateFrom: g.dateFrom,
      dateTo: g.dateTo,
      dailyLimit: g.dailyLimit || 'б/о',
      seasonLimit: g.seasonLimit || 'б/о',
    }));
  }, []);

  const applyGroup = (input: string) => {
    if (!input) return;
    const found = savedGroups.find((g) => g.name.toLowerCase() === input.trim().toLowerCase());
    let resourcesArr: ResourceGroup[] = [];

    if (found) {
      resourcesArr = groupToResources(found);
    } else {
      const animals = input
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (animals.length === 0) {
        alert('Ничего не распознано в вводе. Введите список животных через запятую или выберите сохранённую группу.');
        return;
      }
      if (animals.length > MAX_RESOURCES) {
        if (!window.confirm(`Ввод содержит ${animals.length} животных, максимум ${MAX_RESOURCES}. Обрезать до ${MAX_RESOURCES}?`)) return;
      }
      const truncated = animals.slice(0, MAX_RESOURCES);
      const dateFrom = '2025-09-15';
      const dateTo = '2026-02-28';
      resourcesArr = truncated.map((a) => ({
        resource: a,
        dateFrom,
        dateTo,
        dailyLimit: 'б/о',
        seasonLimit: 'б/о',
      }));
    }

    // обновляем useFieldArray
    replace(resourcesArr);
    setValue('resources', resourcesArr);
  };

  const coords = (data: PrintFormValues) => ({
    fullName: { x: 455, y: 95 },
    hunterTicketSeries: { x: 498, y: 115 },
    hunterTicketNumber: { x: 498, y: 165 },
    hunterIssueDate: { x: 521, yDay: 120, yMonth: 150, yYear: 255 },
    issueDate: { x: 120, yDay: 660, yMonth: 680, yYear: 700 },
    issuedBy: { x: 31, y: 245 },
    organizationName: { x: 45, y: 20 },
    huntingPlace: { x: 346, y: 70 },
    backIssueDate: { x: 60, yDay: 262, yMonth: 285, yYear: 393 },
    huntType: {x:540, y:55},
    resources: data.resources.map((_, i) => ({
      resource: { x: 171 + i * 17, y: 40 },
      dateFrom: { x: 173 + i * 17, y: 143 },
      dateTo: { x: 173 + i * 17, y: 190 },
      dailyLimit: { x: 173 + i * 17, y: 250 },
      seasonLimit: { x: 173 + i * 17, y: 295 },
    })),
  });

  const onSubmit = (data: PrintFormValues) => {
    if (!hunter) return;
    generatePdf({ hunter, form: data, coords: coords(data) });
  };

  const onPrint = async (data: PrintFormValues) => {
    if (!hunter) return;

    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, {
      position: 'fixed',
      left: '-2000px',
      top: '0',
      width: '1px',
      height: '1px',
    });
    document.body.appendChild(iframe);

    // генерируем PDF и получаем Uint8Array
    const pdfBytes = await generatePdf({
      hunter,
      form: data,
      coords: coords(data),
      returnBytes: true,
    });
    if (!pdfBytes) { document.body.removeChild(iframe); return; }

    const bytes = Uint8Array.from(pdfBytes as any);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    iframe.src = url;

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    };

    // автоматически убираем iframe и освобождаем Blob через 5 минут
    setTimeout(() => {
      URL.revokeObjectURL(url);
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      console.log('DEBUG: iframe and Blob cleaned up after 5 minutes');
    }, 300_000);
  };

  const handleAddResource = () => {
    if (fields.length >= MAX_RESOURCES) {
      alert(`Можно добавить максимум ${MAX_RESOURCES} ресурсов.`);
      return;
    }
    append({ resource: '', dateFrom: '', dateTo: '', dailyLimit: '', seasonLimit: '' });
  };

  if (!hunter) return <div className="print-form">Загрузка...</div>;

  return (
    <div className="print-form">
      <button className="back" onClick={() => navigate('/')}>← Назад</button>
      <h1>Заполнение данных для печати</h1>

      <div className="hunter-info">
        <h2>Данные охотника</h2>
        <div className="hunter-fields">
          <div><strong>ФИО:</strong> {hunter.fullName}</div>
          <div><strong>Охотничий билет:</strong> {hunter.series} №{hunter.number}</div>
          <div><strong>Дата выдачи:</strong> {new Date(hunter.issueDate).toLocaleDateString()}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <h2>Параметры охоты</h2>

        <div className="config-fields">
          {configFields.map(f => (
            <label key={String(f.key)}>
              {f.label}:
              <input {...register(f.key)} defaultValue={(cfgRaw as any)[f.key]} />
            </label>
          ))}
        </div>

        {/* выбор/ввод группы */}
        <div className="group-row">
          <input
            list="groups-datalist"
            placeholder="Выбрать или ввести группу (напр. птица осень или Гусь, Утка)"
            value={groupInput}
            onChange={(e) => setGroupInput(e.target.value)}
            className="group-input"
          />
          <datalist id="groups-datalist">
            {savedGroups.map(g => <option key={g.id} value={g.name} />)}
          </datalist>
          <button type="button" className="apply-group" onClick={() => applyGroup(groupInput)}>Применить</button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="resource-group">
            <input {...register(`resources.${index}.resource` as const)} placeholder="Вид ресурса" defaultValue={field.resource} />
            <div className="dates">
              <label>С: <input type="date" {...register(`resources.${index}.dateFrom` as const)} defaultValue={field.dateFrom} /></label>
              <label>По: <input type="date" {...register(`resources.${index}.dateTo` as const)} defaultValue={field.dateTo} /></label>
            </div>
            <input {...register(`resources.${index}.dailyLimit` as const)} placeholder="Норма за день" defaultValue={field.dailyLimit} />
            <input {...register(`resources.${index}.seasonLimit` as const)} placeholder="Норма за сезон" defaultValue={field.seasonLimit} />
            {index > 0 && (
              <button type="button" className="remove" onClick={() => remove(index)}>Удалить</button>
            )}
          </div>
        ))}

        <button type="button" className="add" onClick={handleAddResource}>+ Добавить ресурс</button>

        <div className="extra-fields">
          <label>
            Дата выдачи разрешения:
            <input type="date" {...register('issueDate')} />
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="print" onClick={handleSubmit(onPrint)}>Печать</button>
          <button type="submit" className="submit">Сформировать бланк</button>
        </div>
      </form>
    </div>
  );
};

export default PrintForm;
