// src/components/PrintForm/PrintForm.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { getAllHunters } from '../../db';
// Используем напрямую генераторы PDF из usePrint
import { generateBlankPdf, generateVoucherPdf } from './usePrint';
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
  voucherNumber: string;
  voucherNote: string;
  voucherPermissionNumber: string;
}

const MAX_RESOURCES = 10;

// ключ для локального сохранения черновика формы
const DRAFT_KEY = 'print_form_draft';

const PrintForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [hunter, setHunter] = useState<any>(null);

  const cfgRaw = useMemo(
    () => getConfig() as PrintConfig & { savedGroups?: SavedGroup[] },
    []
  );
  const savedGroups = cfgRaw.savedGroups || [];

  const [blankType, setBlankType] = useState<BlankType>(
    (savedGroups[0]?.blankType as BlankType) || 'Yellow'
  );

  // добавил getValues чтобы сохранить черновик перед навигацией
  const { register, control, handleSubmit, reset, setValue, getValues } = useForm<PrintFormValues>({
    defaultValues: {
      organizationName: cfgRaw.organizationName || '',
      huntingPlace: cfgRaw.huntingPlace || '',
      issuedByName: cfgRaw.issuedByName || '',
      huntType: (cfgRaw as any).huntType || '',
      jobTitle: cfgRaw.jobTitle || '',
      resources: [{ resource: '', dateFrom: '', dateTo: '', dailyLimit: '', seasonLimit: '' }],
      issueDate: new Date().toISOString().substring(0, 10),
      voucherNumber: '',
      voucherNote: '',
      voucherPermissionNumber: '',
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'resources',
  });

  const [groupInput, setGroupInput] = useState('');

  useEffect(() => {
    let mounted = true;

    // Попытка восстановить черновик из localStorage
    const tryLoadDraft = (): Partial<PrintFormValues> | null => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed as Partial<PrintFormValues>;
        return null;
      } catch (e) {
        // парсинг не удался — игнорируем
        return null;
      }
    };

    const draft = tryLoadDraft();

    getAllHunters().then((list) => {
      if (!mounted) return;
      const h = list.find((x) => x.id === Number(id));
      if (h) {
        setHunter(h);

        // дефолты берём из конфига, затем накладываем черновик если есть
        const defaults: PrintFormValues = {
          organizationName: cfgRaw.organizationName || '',
          huntingPlace: cfgRaw.huntingPlace || '',
          issuedByName: cfgRaw.issuedByName || '',
          huntType: (cfgRaw as any).huntType || '',
          jobTitle: cfgRaw.jobTitle || '',
          resources: [{ resource: '', dateFrom: '', dateTo: '', dailyLimit: '', seasonLimit: '' }],
          issueDate: new Date().toISOString().substring(0, 10),
          voucherNumber: '',
          voucherNote: '',
          voucherPermissionNumber: '',
        };

        const merged = { ...defaults, ...(draft || {}) } as PrintFormValues;

        // сбрасываем форму в merged (включая ресурсы)
        reset(merged);
        // явно устанавливаем jobTitle
        setValue('jobTitle', merged.jobTitle);
      } else {
        // если охотник не найден — возвращаемся на главную (защита)
        navigate('/');
      }
    });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, id, reset, setValue]);

  // Преобразует сохранённую группу в массив ресурсов для useFieldArray
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

  // Применить группу (по названию) или список животных, введённый вручную
  const applyGroup = (input: string) => {
    if (!input) return;
    const found = savedGroups.find((g) => g.name.toLowerCase() === input.trim().toLowerCase());
    let resourcesArr: ResourceGroup[] = [];

    if (found) {
      resourcesArr = groupToResources(found);
      const bt = (found.blankType as BlankType) || 'Yellow';
      setBlankType(bt);
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
      setBlankType('Yellow');
    }

    replace(resourcesArr);
    setValue('resources', resourcesArr);
  };

  // Сбор координат в зависимости от выбранного типа бланка
  const buildCoords = (data: PrintFormValues) => {
    const effectiveBlank: BlankType = (blankType as BlankType) || 'Yellow';
    return getCoordsForBlank(effectiveBlank)(data);
  };

  // ---- DOWNLOAD (Сформировать бланк) ----
  const onSubmit = (data: PrintFormValues) => {
    if (!hunter) return;
    const coords = buildCoords(data);

    if (!coords) {
      alert('Ошибка: координаты шаблона не найдены. Проверьте getCoordsForBlank и выбранный тип бланка.');
      return;
    }

    (async () => {
      try {
        // ВЫЗОВ: передаём три аргумента (hunter, form, coords)
        const bytes = await generateBlankPdf(hunter, data, coords);

        if (bytes) {
          // сохранить и скачать
          const blob = new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${(hunter.fullName || 'document')}_разрешение.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          alert('Генерация PDF вернула пустой результат.');
        }
      } catch (err) {
        console.error('Ошибка генерации PDF:', err);
        alert('Ошибка при генерации PDF. Смотри консоль.');
      }
    })();
  };

  // ---- PRINT (через iframe) ----
  const onPrint = async (data: PrintFormValues) => {
    if (!hunter) return;

    const coords = buildCoords(data);
    if (!coords) {
      alert('Ошибка: координаты шаблона не найдены. Проверьте getCoordsForBlank и выбранный тип бланка.');
      return;
    }

    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, {
      position: 'fixed',
      left: '-2000px',
      top: '0',
      width: '1px',
      height: '1px',
    });
    document.body.appendChild(iframe);

    try {
      // ВЫЗОВ: три аргумента
      const pdfBytes = await generateBlankPdf(hunter, data, coords);

      if (!pdfBytes) {
        document.body.removeChild(iframe);
        alert('Ошибка: генерация PDF вернула пустой результат.');
        return;
      }

      const bytes = Uint8Array.from(pdfBytes as any);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      iframe.src = url;

      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      };

      setTimeout(() => {
        URL.revokeObjectURL(url);
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        console.log('DEBUG: iframe and Blob cleaned up after 5 minutes');
      }, 300_000);
    } catch (err) {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      console.error('Ошибка при генерации PDF для печати', err);
    }
  };

  // ---- PRINT VOUCHER ----
  const onPrintVoucher = async (data: PrintFormValues) => {
    if (!hunter) return;

    const r0 = (data.resources && data.resources[0]) || null;
    const voucherFrom = r0?.dateFrom || data.issueDate;
    const voucherTo = r0?.dateTo || data.issueDate;

    const formForVoucher = {
      ...data,
      voucherFrom,
      voucherTo,
    } as PrintFormValues & { voucherFrom: string; voucherTo: string };

    const coords = getCoordsForBlank('Voucher')(formForVoucher as PrintFormValues);

    if (!coords) {
      alert('Ошибка: координаты путёвки не найдены. Проверьте getCoordsForBlank для путёвки и данные формы.');
      return;
    }

    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, {
      position: 'fixed',
      left: '-2000px',
      top: '0',
      width: '1px',
      height: '1px',
    });
    document.body.appendChild(iframe);

    try {
      // ВЫЗОВ: три аргумента
      const pdfBytes = await generateVoucherPdf(hunter, formForVoucher as any, coords);

      if (!pdfBytes) {
        document.body.removeChild(iframe);
        alert('Ошибка: генерация путёвки вернула пустой результат.');
        return;
      }

      const bytes = Uint8Array.from(pdfBytes as any);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      iframe.src = url;

      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      };

      setTimeout(() => {
        URL.revokeObjectURL(url);
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        console.log('DEBUG: iframe and Blob cleaned up after 5 minutes');
      }, 300_000);
    } catch (err) {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      console.error('Ошибка при генерации путёвки для печати', err);
    }
  };

  // Сохранить черновик в localStorage и перейти на главную для выбора другого охотника
  const handleChooseAnother = () => {
    try {
      const values = getValues();
      // сохраняем в localStorage
      localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
    } catch (e) {
      // если что-то не удалось — всё равно переходим
      console.warn('Не удалось сохранить черновик:', e);
    }
    navigate('/');
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
      {/* Кнопка "Выбрать другого охотника" — сохраняет текущую форму и возвращает на главную */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8 }}>
        <button className="select-hunter-btn" type="button" onClick={handleChooseAnother}>
          ← Выбрать другого охотника
        </button>
      </div>

      <h1>Заполнение данных для печати</h1>

      <div className="hunter-info">
        <div className="hunter-top">
          <h2>Данные охотника</h2>
        </div>

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
              <input {...register(f.key as any)} defaultValue={(cfgRaw as any)[f.key]} />
            </label>
          ))}
        </div>

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

        <h3>Путёвка</h3>

        <div className="resource-group voucher-block">
          <label>
            Номер путёвки:
            <input type="text" {...register('voucherNumber')} />
          </label>

          <div className="dates">
            <label>С: <input type="date" {...register('resources.0.dateFrom' as const)} /></label>
            <label>По: <input type="date" {...register('resources.0.dateTo' as const)} /></label>
          </div>

          <label>
            Должность:
            <input type="text" {...register('jobTitle')} defaultValue={cfgRaw.jobTitle || ''} />
          </label>

          <label>
            Особая отметка:
            <input type="text" {...register('voucherNote')} />
          </label>

          <label>
            Предоставление охоты по разрешению №:
            <input type="text" {...register('voucherPermissionNumber')} />
          </label>

          <div className="group-controls voucher-actions">
            <button type="button" className="submit" onClick={handleSubmit(onPrintVoucher)}>Распечатать путёвку</button>
          </div>
        </div>

      </form>
    </div>
  );
};

export default PrintForm;
