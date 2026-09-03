import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { overtoneUrl } from '../utils/overtoneUrl';
import OvertoneModal from '../components/OvertoneModal';

// Builds the "🔍 Overtone" entry for a PlayActionsMenu overflow menu, plus
// the modal it opens. Lives in a hook (rather than inside AboutSection, or
// duplicated per page) since Album and Artist both need it and the modal's
// open state has to live wherever the overflow menu item is rendered.
export const useOvertoneAction = (musicbrainzId, entityType = 'artist') => {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  if (!musicbrainzId) return { overflowAction: null, modal: null };

  const url = overtoneUrl(musicbrainzId, entityType);

  return {
    overflowAction: { key: 'overtone', icon: '🔍', label: 'Overtone', onClick: () => setShow(true) },
    modal: show ? <OvertoneModal url={url} onClose={() => setShow(false)} onNavigate={navigate} /> : null,
  };
};
