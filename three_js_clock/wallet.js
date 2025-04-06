// On attend que la page soit chargée
let contract;

const CONTRACT_ADDRESS = "0xeBa9c2c94a1Fc2e2A486D91ee1E6cC79ce7370e0";
    
    // ABI simplifiée du contrat
    const CONTRACT_ABI = [
    // Variables publiques
    "function owner() view returns (address)",
    "function ticketPrice() view returns (uint256)",
    "function nextClockId() view returns (uint256)",
    "function clocksNum() view returns (uint256)",
    
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

document.addEventListener('DOMContentLoaded', () => {
    const connectBtn = document.getElementById('connect-wallet');
    
    //// Adresse de votre contrat déployé
    //const CONTRACT_ADDRESS = "0x8b24fC16AF5FC008466b9188E34f342e2e164380";
    //
    //// ABI simplifiée du contrat
    //const CONTRACT_ABI = [
    //// Variables publiques
    //"function owner() view returns (address)",
    //"function ticketPrice() view returns (uint256)",
    //"function nextClockId() view returns (uint256)",
    //"function clocksNum() view returns (uint256)",
    //
    //// Mappings publics
    //"function userTickets(address) view returns (uint256)",
    //"function clocks(uint256) view returns (uint256 id, uint256 prize, address lastBidder, bool isActive, bool isFinalized)",
    //
    //// Fonctions d'achat et de gestion des tickets
    //"function buyTickets(uint256 _amount) payable",
    //"function getTicketPrice(uint256 _amount) view returns (uint256)",
    //"function getTicketBalance(address _user) view returns (uint256)",
    //
    //// Fonctions de gestion des horloges
    //"function createClock(uint256 _prize) payable",
    //"function recordParticipation(uint256 clockId, address participant)",
    //"function finalizeClock(uint256 clockId)",
    //
    //// Fonction admin
    //"function withdraw(uint256 _amount)",
    //
    //// Événements
    //"event TicketsPurchased(address indexed buyer, uint256 amount)",
    //"event ClockCreated(uint256 indexed clockId, uint256 prize)",
    //"event ParticipationRecorded(uint256 indexed clockId, address indexed participant)",
    //"event ClockFinalized(uint256 indexed clockId, address winner, uint256 prize)"
    //];
    //
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
                    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
                    
                    // Exposer le contrat globalement
                    window.contract = contract;
                    
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

// Fonction pour afficher le nombre d'horloges dans la console
async function afficherNombreHorloges() {
    if (!contract) {
        // S'assurer que le contrat est initialisé
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    }
    
    try {
        const clocksNum = await contract.clocksNum();
        console.log("Nombre d'horloges sur la blockchain:", clocksNum.toNumber());
    } catch (error) {
        console.error("Erreur lors de la récupération du nombre d'horloges:", error);
    }
}

// Exposer la fonction
window.afficherNombreHorloges = afficherNombreHorloges;

async function recordParticipation(clockId) {
    if (!contract) {
        // S'assurer que le contrat est initialisé
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    }
    
    try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length === 0) {
            console.error("Aucun compte connecté");
            return;
        }
        
        const userAddress = accounts[0];
        
        // Vérifier si l'utilisateur a des tickets
        const ticketBalance = await contract.getTicketBalance(userAddress);
        if (ticketBalance.toNumber() <= 0) {
            alert("Vous n'avez pas de tickets. Achetez-en d'abord.");
            return;
        }
        
        // Appeler la fonction recordParticipation du contrat
        const tx = await contract.recordParticipation(clockId, userAddress);
        await tx.wait();
        
        console.log(`Participation enregistrée pour l'horloge ${clockId}`);
        alert(`Vous avez utilisé un ticket pour participer à l'horloge ${clockId}!`);
        return true;
    } catch (error) {
        console.error("Erreur lors de l'enregistrement de la participation:", error);
        alert("Erreur lors de l'utilisation du ticket: " + error.message);
        return false;
    }
}

// Exposer la fonction
window.recordParticipation = recordParticipation;
