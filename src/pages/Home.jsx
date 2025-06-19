// src/pages/Home.jsx
import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import ArtistGrid from '../components/ArtistGrid';
import SearchBar from '../components/SearchBar';
import Retry from '../components/Retry';
import Loading from '../components/Loading';

const Home = () => {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRandomArtists = async () => {
      try {
        setLoading(true);
        const response = await apiService.getRandomArtists(60);
        console.log('API Response:', response.data);
        setArtists(response.data);
      } catch (error) {
        console.error('Error fetching random artists:', error);
        setError('Failed to load artists');
      } finally {
        setLoading(false);
      }
    };

    fetchRandomArtists();
  }, []);

  // Remove the handleArtistClick function since ArtistGrid will handle navigation internally

  if (loading) {
    return (
      <Loading message='Loading artists' />
    );
  }

  if (error) {
    return (
      <Retry error={error}/>
    );
  }

  return (
    <ArtistGrid artists={artists} imageContext="artist_search" />
  );
};

export default Home;
