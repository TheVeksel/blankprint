// src/db.ts
// Простая работа с IndexedDB для офлайн хранения данных пользователей

interface Hunter {
  id?: number;
  fullName: string;       // ФИО
  series: string;         // Серия билета (например, "78")
  number: string;         // Номер билета (например, "014843")
  issueDate: string;      // Дата выдачи (например, "2022-03-01")
}

const DB_NAME = 'huntersDB';
const STORE_NAME = 'hunters';
const DB_VERSION = 1;

// Открытие или создание базы
export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};
export const getHunterById = async (id: number) => {
  const db = await openDB();
  return new Promise<any>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

// Добавить нового охотника
export const addHunter = async (hunter: Hunter): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add(hunter);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// Получить всех охотников
export const getAllHunters = async (): Promise<Hunter[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Обновить данные охотника
export const updateHunter = async (hunter: Hunter): Promise<void> => {
  if (hunter.id === undefined) throw new Error('Не указан id охотника');
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(hunter);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// Очистить базу
export const clearHunters = async (): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// Удалить одного охотника
export const deleteHunter = async (id: number): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};
