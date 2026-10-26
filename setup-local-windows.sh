# ==============================================================================
# CLOUD CONSOLE WINDOWS SETUP HELPER
# ------------------------------------------------------------------------------
# This script is intended to be run in a Windows PowerShell or Bash terminal
# to help prepare the local environment for the Cloud Console project.
# ==============================================================================

# This is a documentation-style script. For Windows users, follow these steps:

echo "--- Cloud Console Windows Environment Setup ---"
echo ""
echo "1. INSTALLATION REQUIREMENTS:"
echo "   - Node.js (v18 or higher) - https://nodejs.org/"
echo "   - PostgreSQL (v14 or higher) - https://www.postgresql.org/"
echo "   - Git - https://git-scm.com/"
echo ""
echo "2. DATABASE SETUP:"
echo "   - Open pgAdmin or psql"
echo "   - Create a database named 'cloud_console2'"
echo "   - Update the DATABASE_URL in your .env file:"
echo "     DATABASE_URL=\"postgresql://postgres:itrsud2021@localhost:5432/cloud_console2?schema=public""
echo ""
echo "3. PROJECT INITIALIZATION:"
echo "   - cd F:/AI/cloud-console/cloud-consolev2"
echo "   - npm install"
echo "   - npx prisma generate"
echo "   - npx prisma db push"
echo ""
echo "4. RUNNING THE APPLICATION:"
echo "   - npm run dev"
echo "   - Open browser to http://localhost:3000"
echo ""
echo "5. VPS CONNECTION TIPS:"
echo "   - Ensure your VPS firewall allows UDP port 51820 (WireGuard)"
echo "   - Ensure SSH port 22 is open for the Cloud Console API to connect"
echo ""
echo "--------------------------------------------------"
echo "Setup process completed!"
