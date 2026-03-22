// src/pages/AdminLogs.jsx
import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import Loading from '../components/Loading';
import Retry from '../components/Retry';

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadLogs(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const loadLogs = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getLogs(page, 25);
      setLogs(response.data.logs);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || (pagination && newPage > pagination.totalPages)) return;
    setCurrentPage(newPage);
    window.scrollTo(0, 0);
  };

  if (loading && !logs.length) return <Loading />;
  if (error) return <Retry message={error} onRetry={() => loadLogs(currentPage)} />;

  return (
    <div style={{ padding: '2rem', backgroundColor: '#f3f4f6', minHeight: '100%' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>
          Activity Logs
        </h1>
        {pagination && (
          <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>
            Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()} entries
          </p>
        )}
      </div>

      {/* Logs Table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>
                  ID
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>
                  Date/Time
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>
                  Action
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>
                  Track
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>
                  Artist
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>
                  Album
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>
                  IP Address
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                    No log entries found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      {log.id}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#1f2937', whiteSpace: 'nowrap' }}>
                      {formatDate(log.created_at)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        backgroundColor: log.action === 'stream' ? '#dbeafe' : '#e5e7eb',
                        color: log.action === 'stream' ? '#1e40af' : '#374151',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                      }}>
                        {log.action || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#1f2937' }}>
                      {log.track_title || '-'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#1f2937' }}>
                      {log.artist_name || '-'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#1f2937' }}>
                      {log.album_title || '-'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280', fontFamily: 'monospace' }}>
                      {log.ip_address || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div style={{
          marginTop: '2rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: currentPage === 1 ? '#e5e7eb' : '#3b82f6',
              color: currentPage === 1 ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
          >
            Previous
          </button>

          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: currentPage === pageNum ? '#3b82f6' : 'white',
                    color: currentPage === pageNum ? 'white' : '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: currentPage === pageNum ? '600' : '400',
                  }}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === pagination.totalPages}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: currentPage === pagination.totalPages ? '#e5e7eb' : '#3b82f6',
              color: currentPage === pagination.totalPages ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === pagination.totalPages ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
