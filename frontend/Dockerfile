# Estágio 1: Build da aplicação React
FROM node:20-alpine as build

WORKDIR /app

# Define os ARGs para capturar as variáveis do Easypanel
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_PRN_ANALYSIS_API_URL
ARG VITE_DUPLICITY_ANALYSIS_API_URL

# Exporta como ENV para o processo de build
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}
ENV VITE_PRN_ANALYSIS_API_URL=${VITE_PRN_ANALYSIS_API_URL}
ENV VITE_DUPLICITY_ANALYSIS_API_URL=${VITE_DUPLICITY_ANALYSIS_API_URL}

# Copia arquivos de dependências
COPY package*.json ./

# Instala dependências
RUN npm install

# Copia o restante do código
COPY . .

# Comando de build do Vite
RUN npm run build

# Estágio 2: Servidor Nginx para produção
FROM nginx:stable-alpine

# Copia os arquivos gerados no build para o diretório do Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copia a configuração customizada do Nginx para suportar SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expõe a porta 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]