import { useRef, useState } from 'react';
import { Box, Typography, Stack, IconButton } from '@mui/material';
import { Upload, FileText, X } from 'lucide-react';
import { tokens } from '../../theme/theme';

const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx';
const MAX_SIZE_MB = 10;

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDropzone({ label, files, onChange, multiple = true }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const addFiles = (fileList) => {
    setError('');
    const incoming = Array.from(fileList);
    const oversized = incoming.find((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversized) {
      setError(`"${oversized.name}" exceeds the ${MAX_SIZE_MB}MB limit and was not added.`);
    }
    const valid = incoming.filter((f) => f.size <= MAX_SIZE_MB * 1024 * 1024);
    onChange(multiple ? [...files, ...valid] : valid.slice(0, 1));
  };

  const removeFile = (index) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <Box>
      {label && <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>{label}</Typography>}
      <Box
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        sx={{
          border: `1.5px dashed ${dragOver ? tokens.ashokaNavy : tokens.border}`,
          borderRadius: 1.5,
          p: 2.5,
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: dragOver ? `${tokens.ashokaNavy}0A` : 'transparent',
          transition: 'all 0.15s ease',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={ACCEPTED}
          hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
        <Upload size={22} color={tokens.inkMuted} />
        <Typography variant="body2" sx={{ mt: 1 }}>
          Drag &amp; drop files here, or <Box component="span" sx={{ color: tokens.ashokaNavy, fontWeight: 600 }}>browse</Box>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          PDF, JPG, PNG, WEBP, DOC, DOCX — up to {MAX_SIZE_MB}MB each
        </Typography>
      </Box>

      {error && <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.75 }}>{error}</Typography>}

      {files.length > 0 && (
        <Stack gap={0.75} sx={{ mt: 1.5 }}>
          {files.map((file, i) => (
            <Box
              key={`${file.name}-${i}`}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.75,
                border: `1px solid ${tokens.border}`, borderRadius: 1,
              }}
            >
              <FileText size={16} color={tokens.ashokaNavy} style={{ flexShrink: 0 }} />
              <Typography variant="body2" noWrap sx={{ flex: 1 }}>{file.name}</Typography>
              <Typography variant="caption" color="text.secondary">{formatSize(file.size)}</Typography>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeFile(i); }}>
                <X size={14} />
              </IconButton>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
