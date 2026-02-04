'use strict'

/**
 * FUNCTIONALITY OVERVIEW
 * 
 * The client-side cache is implemented using the IndexedDB API which is recognized
 * by JavaScript by default and is available in any modern browser.
 * 
 * The implentation allows for the cache to be used for any type of data.
 * Note that caching images or WebGL related data in not possible, as that is taken
 * care of by the browser implicitly. 
 * Such data may be "cached" by preloading them at the initialization of the application.
 * 
 * NOTE: Promises have to be used due to the callback nature of the IndexedDB API.
 * The .onsuccess / .onerror callbacks run later and do not work together 
 * with the async/await workflow.
 * 
 * Video tutorial for IndexedDB: https://www.youtube.com/watch?v=yZ26CXny3iI
 * 
 * ----------------------
 */


/* GLOBAL VARIABLES */

const indexedDB =
  window.indexedDB ||
  window.mozIndexedDB ||
  window.webkitIndexedDB ||
  window.msIndexedDB ||
  window.shimIndexedDB;

/**/

/**
 * Creates a new database or finds and opens an existing one using `databaseName` and returns it.
 * @param {*} databaseName 
 * @param {*} storeName name of the object store unit in a database, e.g. "images"
 * @param {*} keyType name of the key attribute - a unique identifier for each record, e.g. "id"
 * @param {*} databaseVersion value that is incremented when requiring a database update, implicitly set to 1
 * @returns database object on success, otherwise an error
 */
async function openDatabase(databaseName, storeName, keyType, databaseVersion = 1)
{
  return new Promise((resolve, reject) => {
    if (!indexedDB)
      console.log("IndexedDB could not be found in this browser.");
    
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

/**
 * Opens a database `databaseName` and returns an object from the object store `storeName` by the given `key`.
 * @param {*} databaseName 
 * @param {*} storeName name of the object store unit in a database, e.g. "images"
 * @param {*} keyType name of the key attribute - a unique identifier for each record, e.g. "id"
 * @param {*} key a unique identifier for a specific database entry, e.g. a file path
 * @returns a stored object uniquely identfied by `key` on success, an error otherwise
 */
export async function getCache(databaseName, storeName, keyType, key, databaseVersion = 1)
{
  const db = await openDatabase(databaseName, storeName, keyType, databaseVersion);

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

/**
 * Opens a database `databaseName` and stores `data` into the object store `storeName` using its identifier `key`.
 * @param {*} databaseName 
 * @param {*} storeName name of the object store unit in a database, e.g. "images"
 * @param {*} keyType name of the key attribute - a unique identifier for each record, e.g. "id"
 * @param {*} key a unique identifier for a specific database entry, e.g. a file path
 * @param {*} data data that will be cached
 * @param {*} databaseVersion value that is incremented when requiring a database update, implicitly set to 1
 * @returns null on success, otherwise an error
 */
export async function setCache(databaseName, storeName, keyType, key, data, databaseVersion = 1)
{
  const db = await openDatabase(databaseName, storeName, keyType, databaseVersion);

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
