// On attend que la page soit chargée
document.addEventListener('DOMContentLoaded', () => {
    const connectBtn = document.getElementById('connect-wallet');
    
    // Adresse de votre contrat déployé
    const CONTRACT_ADDRESS = "0x2016889d4ad5c2f9535B0B5e4dc1c7D3f265E0cc";
    
    // ABI simplifiée du contrat
    const CONTRACT_ABI = [
    // Variables publiques
    "function owner() view returns (address)",
    "function ticketPrice() view returns (uint256)",
    "function nextClockId() view returns (uint256)",
    
    // Mappings publics
    "function userTickets(address) view returns (uint256)",
    "function clocks(uint256) view returns (uint256 id, uint256 prize, address lastBidder, bool isActive, bool isFinalized)",
    
    // Fonctions d'achat et de gestion des tickets
    "function buyTickets(uint256 _amount) payable",
    "function getTicketPrice(uint256 _amount) view returns (uint256)",
    "function getTicketBalance(address _user) view returns (uint256)",
    
    // Fonctions de gestion des horloges
    "function createClock(uint256 _prize) payable",
    "function recordParticipation(uint256 clockId, address participant)",
    "function finalizeClock(uint256 clockId)",
    
    // Fonction admin
    "function withdraw(uint256 _amount)",
    
    // Événements
    "event TicketsPurchased(address indexed buyer, uint256 amount)",
    "event ClockCreated(uint256 indexed clockId, uint256 prize)",
    "event ParticipationRecorded(uint256 indexed clockId, address indexed participant)",
    "event ClockFinalized(uint256 indexed clockId, address winner, uint256 prize)"
    ];
    
    connectBtn.addEventListener('click', async () => {
        try {
            // Vérifier si MetaMask est installé
            if (!window.ethereum) {
                alert("MetaMask n'est pas installé. Veuillez l'installer pour continuer.");
                return;
            }
            
            // Demander l'accès au compte
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const account = accounts[0];
            
            // Changer le texte du bouton
            connectBtn.textContent = 'Wallet Connecté';
            connectBtn.style.backgroundColor = '#21ba45';
            
            // Connexion au contrat (si ethers.js est disponible)
            if (window.ethers) {
                try {
                    // Créer provider et signer
                    const provider = new ethers.providers.Web3Provider(window.ethereum);
                    const signer = provider.getSigner();
                    
                    // Initialiser le contrat
                    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
                    
                    console.log("Contrat initialisé avec succès");
                    console.log("Adresse connectée:", account);
                    
                    // Stocker le contrat dans une variable globale pour l'utiliser ailleurs
                    window.contractInstance = contract;
                    
                } catch (error) {
                    console.error("Erreur d'initialisation du contrat:", error);
                }
            } else {
                console.warn("ethers.js n'est pas chargé. Le contrat ne sera pas initialisé.");
            }
            
            // Écouter les changements de compte
            window.ethereum.on('accountsChanged', (accounts) => {
                const newAccount = accounts[0];
                if (newAccount) {
                    console.log("Compte changé:", newAccount);
                    connectBtn.textContent = 'Wallet Connecté';
                    connectBtn.style.backgroundColor = '#21ba45';
                } else {
                    connectBtn.textContent = 'Connect your wallet';
                    connectBtn.style.backgroundColor = '';
                }
            });
            
            // Écouter les changements de réseau
            window.ethereum.on('chainChanged', () => {
                console.log("Réseau changé, rechargement de la page");
                window.location.reload();
            });
            
        } catch (error) {
            console.error("Erreur de connexion:", error);
            alert(`Erreur de connexion: ${error.message}`);
        }
    });
});