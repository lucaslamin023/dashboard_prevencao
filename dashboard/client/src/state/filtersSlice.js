import { createSlice } from '@reduxjs/toolkit';

const initialFilters = {
  regiao: '',
  estado: '',
  filial: '',
  comprador: '',
  categoria: '',
  dataIni: '',
  dataFim: '',
};

export const filtersSlice = createSlice({
  name: 'filters',
  initialState: {
    mode: localStorage.getItem('themeMode') || 'dark',
    ...initialFilters,
  },
  reducers: {
    setFilter: (state, action) => {
      const { key, value } = action.payload;
      state[key] = value;
      // Ao mudar de região, limpa o estado se não pertencer
      if (key === 'regiao') {
        state.estado = '';
        state.filial = '';
      }
      if (key === 'estado') {
        state.filial = '';
      }
    },
    setFilters: (state, action) => {
      return { ...state, ...action.payload };
    },
    resetFilters: (state) => {
      Object.assign(state, initialFilters);
    },
    toggleMode: (state) => {
      state.mode = state.mode === 'dark' ? 'light' : 'dark';
      localStorage.setItem('themeMode', state.mode);
    },
  },
});

export const { setFilter, setFilters, resetFilters, toggleMode } = filtersSlice.actions;

export default filtersSlice.reducer;
