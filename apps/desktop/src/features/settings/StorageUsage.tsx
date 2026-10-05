import { useEffect, useState } from 'react';
import { api, errorText } from '../../api/client';

export function StorageUsage() {
  const [usage, setUsage] = useState<{
    libraryBytes: number;
    modelBytes: number;
  }>();
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    void api
      .storageUsage()
      .then((v) => {
        if (!disposed) setUsage(v);
      })
      .catch((e) => {
        if (!disposed) setError(errorText(e));
      });
    return () => {
      disposed = true;
    };
  }, []);
  const size = (bytes: number) =>
    bytes >= 1073741824
      ? `${(bytes / 1073741824).toFixed(2)} GB`
      : `${(bytes / 1048576).toFixed(1)} MB`;
  return (
    <div className="storage-usage" role="status">
      {error ||
        (usage ? (
          <>
            <span>
              <strong>{size(usage.libraryBytes)}</strong>
              {'资料库与导出文件'}
            </span>
            <span>
              <strong>{size(usage.modelBytes)}</strong>
              {'本地模型'}
            </span>
          </>
        ) : (
          '正在计算存储占用…'
        ))}
    </div>
  );
}
