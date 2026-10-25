import { configureStore } from '@reduxjs/toolkit';
import filtersReducer from './filtersSlice.js';
import { api } from './api.js';

export const store = configureStore({
  reducer: {
    filters: filtersReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefault) => getDefault().concat(api.middleware),
});

export default store;
