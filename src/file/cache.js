'use strict'

const indexedDB =
  window.indexedDB ||
  window.mozIndexedDB ||
  window.webkitIndexedDB ||
  window.msIndexedDB ||
  window.shimIndexedDB;

// NOTE: Promises have to be used due to the callback nature of the IndexedDB API.
// The .onsuccess / .onerror callbacks run later and do not work together with the async/await workflow

// Video tutorial for IndexedDB:
// https://www.youtube.com/watch?v=yZ26CXny3iI

async function openDatabase(databaseName, databaseVersion, storeName, keyType)
{
  return new Promise((resolve, reject) => {
    if (!indexedDB)
      console.log("IndexedDB could not be found in this browser.");
    
    // Creates a new database or finds (using the string) and opens an existing one
    const request = indexedDB.open(databaseName, databaseVersion);
  
    request.onerror = (event) => {
      console.error("An error occurred with IndexedDB");
      console.error(event);
      reject(event);
    };
    
    // Runs when new db is created or the version number is changed
    request.onupgradeneeded = () => {
      // db with no data nor space for data
      const db = request.result;
  
      // populate db with storage space
      if (!db.objectStoreNames.contains(storeName))
        db.createObjectStore(storeName, {keyPath: keyType});
    };
  
    // Runs after .onupgradeneeded
    request.onsuccess = () => {
        resolve(request.result);
    };
  });
}

export async function getCache(databaseName, keyType, key, storeName)
{
  const db = await openDatabase(databaseName, 1, storeName, keyType);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");

    // Look up the object store by its name
    const objectStore = transaction.objectStore(storeName);
    const cacheQuery = objectStore.get(key);
    
    cacheQuery.onerror = (event) => {
      db.close();
      console.log("An error occured when getting cache from IndexedDB database.");
      reject(event);
    };

    cacheQuery.onsuccess = () => {
      db.close();
      resolve(cacheQuery.result[storeName]);
    };
  });
}

export async function setCache(databaseName, databaseVersion, keyType, key, storeName, data)
{
  const db = await openDatabase(databaseName, databaseVersion, storeName, keyType);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");

    // Look up the object store by its name
    const objectStore = transaction.objectStore(storeName);
    const cacheQuery = objectStore.put({[keyType]: key, [storeName]: data});
    
    cacheQuery.onerror = (event) => {
      console.log("An error occured when setting cache to IndexedDB database.");
      reject(event);
    };

    cacheQuery.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}
