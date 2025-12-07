import ShareDB from 'sharedb';

// Single ShareDB backend instance shared across the application
console.log('[ShareDB] Creating backend instance');
export const backend = new ShareDB({ presence: true });
console.log('[ShareDB] Backend created');

/**
 * Ensure a document exists in ShareDB with the given content.
 * This must be called BEFORE a client tries to subscribe.
 */
export function ensureDoc(docId: string, content: string): Promise<void> {
  console.log(`[ShareDB] ensureDoc called for ${docId} with ${content.length} chars`);

  return new Promise((resolve, reject) => {
    const connection = backend.connect();
    const doc = connection.get('documents', docId);

    doc.fetch((err: any) => {
      if (err) {
        console.error(`[ShareDB] ensureDoc fetch error for ${docId}:`, err);
        connection.close();
        reject(err);
        return;
      }

      console.log(`[ShareDB] ensureDoc fetched ${docId}, type:`, doc.type);

      if (doc.type === null) {
        console.log(`[ShareDB] Creating doc ${docId} with ${content.length} chars`);
        doc.create({ content }, (createErr: any) => {
          if (createErr) {
            console.error(`[ShareDB] ensureDoc create error for ${docId}:`, createErr);
            connection.close();
            reject(createErr);
          } else {
            console.log(`[ShareDB] Doc ${docId} created successfully`);
            connection.close();
            resolve();
          }
        });
      } else {
        console.log(`[ShareDB] Doc ${docId} already exists, type:`, doc.type, 'data:', doc.data);
        connection.close();
        resolve();
      }
    });
  });
}

/**
 * Get the current content of a ShareDB document.
 */
export function getDocContent(docId: string): Promise<string | null> {
  return new Promise((resolve) => {
    const connection = backend.connect();
    const doc = connection.get('documents', docId);

    doc.fetch((err: any) => {
      if (err || doc.type === null) {
        connection.close();
        resolve(null);
        return;
      }

      const content = doc.data?.content || '';
      connection.close();
      resolve(content);
    });
  });
}
