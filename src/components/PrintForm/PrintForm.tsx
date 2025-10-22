// src/components/PrintForm/PrintForm.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { getAllHunters } from '../../db';
import { generatePdf } from './usePrint';
import { getConfig, type PrintConfig } from '../../utils/config';
import { getCoordsForBlank, type BlankType } from '../../utils/coords';
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

  const cfgRaw = useMemo(
    () => getConfig() as PrintConfig & { savedGroups?: SavedGroup[] },
    []
  );
  const savedGroups = cfgRaw.savedGroups || [];

  // default blank type: if there are saved groups, use the first group's blankType, otherwise Yellow
  const [blankType, setBlankType] = useState<BlankType>(
    (savedGroups[0]?.blankType as BlankType) || 'Yellow'
  );

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
    let mounted = true;
    getAllHunters().then((list) => {
      if (!mounted) return;
      const h = list.find((x) => x.id === Number(id));
      if (h) {
        setHunter(h);

        const defaults: PrintFormValues = {
          organizationName: cfgRaw.organizationName || '',
          huntingPlace: cfgRaw.huntingPlace || '',
          issuedByName: cfgRaw.issuedByName || '',
          huntType: (cfgRaw as any).huntType || '',
          resources:
            // keep existing resources if any, otherwise a single empty row
            [{ resource: '', dateFrom: '', dateTo: '', dailyLimit: '', seasonLimit: '' }],
          issueDate: new Date().toISOString().substring(0, 10),
        };

        reset(defaults);
      } else {
        navigate('/');
      }
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, id, reset]);

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
      // set blank type from the saved group
      setBlankType(found.blankType as BlankType);
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
      // default dates for manual entry groups (you can change)
      const dateFrom = '2025-09-15';
      const dateTo = '2026-02-28';
      resourcesArr = truncated.map((a) => ({
        resource: a,
        dateFrom,
        dateTo,
        dailyLimit: 'б/о',
        seasonLimit: 'б/о',
      }));
      // for manual input, fallback to Yellow (or keep previous — choose fallback)
      setBlankType('Yellow');
    }

    // обновляем useFieldArray и форму
    replace(resourcesArr);
    setValue('resources', resourcesArr);
  };

  // local coords removed; use getCoordsForBlank(blankType)(data) below

  const onSubmit = (data: PrintFormValues) => {
    if (!hunter) return;
    generatePdf({
      hunter,
      form: data,
      coords: getCoordsForBlank(blankType)(data),
    });
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
      coords: getCoordsForBlank(blankType)(data),
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
              <input {...register(f.key as any)} />
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
            <input {...register(`resources.${index}.resource` as const)} placeholder="Вид ресурса" />
            <div className="dates">
              <label>С: <input type="date" {...register(`resources.${index}.dateFrom` as const)} /></label>
              <label>По: <input type="date" {...register(`resources.${index}.dateTo` as const)} /></label>
            </div>
            <input {...register(`resources.${index}.dailyLimit` as const)} placeholder="Норма за день" />
            <input {...register(`resources.${index}.seasonLimit` as const)} placeholder="Норма за сезон" />
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
