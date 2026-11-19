import { Platform } from 'react-native';

/**
 * URL de l'API NestJS. À définir dans mobile/.env (voir .env.example) :
 *   EXPO_PUBLIC_API_URL=http://192.168.1.20:3000/api   (téléphone réel, IP du PC)
 * Par défaut : émulateur Android (10.0.2.2) / simulateur iOS (localhost).
 */
const fallback = Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? fallback).replace(/\/+$/, '');

/** Client OAuth « Web » de Google (sert à obtenir un id_token vérifiable par l'API). Vide = bouton masqué. */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
