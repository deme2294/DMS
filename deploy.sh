#!/usr/bin/env bash
# ==============================================================================
# DMS Automated 1-Click Linux Deployment Script
# ==============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "\n${CYAN}${BOLD}======================================================${NC}"
echo -e "${CYAN}${BOLD}   🛡️  DMS Help Desk System — Automated Linux Deployment${NC}"
echo -e "${CYAN}${BOLD}======================================================${NC}\n"

# 1. Verify Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker is not installed. Installing Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER || true
    echo -e "${GREEN}✓ Docker installed successfully.${NC}"
fi

# 2. Verify Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo -e "${RED}Docker Compose plugin not found. Installing docker-compose-plugin...${NC}"
    sudo apt-get update && sudo apt-get install -y docker-compose-plugin
fi

# 3. Detect or create .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating production .env from .env.example...${NC}"
    cp .env.example .env

    # Generate random strong production secrets
    JWT_SECRET=$(openssl rand -hex 32)
    SESSION_SECRET=$(openssl rand -hex 32)
    JWT_ACCESS_SECRET=$(openssl rand -hex 32)
    JWT_REFRESH_SECRET=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -hex 16)
    DB_ROOT_PASSWORD=$(openssl rand -hex 16)

    # Detect public IP
    DETECTED_IP=$(curl -s https://api.ipify.org || echo "localhost")

    # Update .env with generated secrets
    sed -i "s/replace_with_32_plus_char_random_jwt_secret/$JWT_SECRET/" .env
    sed -i "s/replace_with_32_plus_char_random_session_secret/$SESSION_SECRET/" .env
    sed -i "s/replace_with_32_plus_char_random_access_secret/$JWT_ACCESS_SECRET/" .env
    sed -i "s/replace_with_32_plus_char_random_refresh_secret/$JWT_REFRESH_SECRET/" .env
    sed -i "s/replace_with_strong_database_password/$DB_PASSWORD/" .env
    sed -i "s/replace_with_strong_root_password/$DB_ROOT_PASSWORD/" .env
    sed -i "s|https://helpdesk.yourdomain.com|http://$DETECTED_IP|" .env

    echo -e "${GREEN}✓ Generated secure random credentials and configured FRONTEND_URL=http://$DETECTED_IP in .env${NC}"
fi

# 4. Build and start containers
echo -e "\n${CYAN}Building and starting DMS production containers...${NC}"
docker compose -f docker-compose.deploy.yml up -d --build

# 5. Wait for backend healthcheck
echo -e "\n${YELLOW}Waiting for database initialization and services to become healthy (15-20s)...${NC}"
sleep 15

# 6. Display status
echo -e "\n${GREEN}${BOLD}✓ Deployment Completed Successfully!${NC}\n"
docker compose -f docker-compose.deploy.yml ps

SERVER_IP=$(curl -s https://api.ipify.org 2>/dev/null || echo "your-server-ip")

echo -e "\n${CYAN}${BOLD}------------------------------------------------------${NC}"
echo -e "${BOLD}Access the DMS Help Desk System:${NC}"
echo -e "🌐 Web Application URL: ${GREEN}${BOLD}http://${SERVER_IP}${NC}"
echo -e "\n${BOLD}Pre-configured Default Accounts (Seed):${NC}"
echo -e " • System Admin:       ${YELLOW}admin${NC} / ${YELLOW}password${NC}"
echo -e " • Department Manager: ${YELLOW}manager${NC} / ${YELLOW}password${NC}"
echo -e " • Technical Staff:    ${YELLOW}staff${NC} / ${YELLOW}password${NC}"
echo -e " • Tenant Client:      ${YELLOW}tenant${NC} / ${YELLOW}password${NC}"
echo -e " • CEO Executive:      ${YELLOW}ceo${NC} / ${YELLOW}password${NC}"
echo -e "${CYAN}${BOLD}------------------------------------------------------${NC}\n"
