document.addEventListener('DOMContentLoaded', () => {
    const connectBtn = document.getElementById('connect-wallet');
    const walletInfo = document.getElementById('wallet-info');
    const walletAddress = document.getElementById('wallet-address');
    const userTickets = document.getElementById('user-tickets');
    const notification = document.getElementById('notification');
    
    // Adresse de votre contrat déployé
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
    
    // Variable pour stocker le contrat
    let contract = null;
    let userAccount = null;
    
    // Fonction pour afficher une notification
    function showNotification(message, isError = false) {
        notification.textContent = message;
        notification.style.background = isError ? 'rgba(255, 0, 0, 0.9)' : 'rgba(33, 186, 69, 0.9)';
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 5000);
    }
    
    // Fonction pour mettre à jour le nombre de tickets
    async function updateTicketCount() {
        if (contract && userAccount) {
            try {
                console.log("Contrat :", contract);
                console.log("Adresse utilisateur :", userAccount);
                
                // Essayer d'appeler nextClockId en premier pour voir si le contrat répond
                try {
                    const nextId = await contract.nextClockId();
                    console.log("ID horloge suivante :", nextId.toString());
                } catch (clockError) {
                    console.error("Erreur avec nextClockId :", clockError);
                }
                
                // Puis essayer getTicketBalance (nouvelle méthode)
                try {
                    const ticketCount = await contract.getTicketBalance(userAccount);
                    console.log("Tickets lus (getTicketBalance) :", ticketCount.toString());
                    userTickets.textContent = ticketCount.toString();
                    return;
                } catch (ticketError) {
                    console.error("Erreur avec getTicketBalance :", ticketError);
                }
                
                // Si getTicketBalance échoue, essayer userTickets (méthode alternative)
                const ticketCount = await contract.userTickets(userAccount);
                console.log("Tickets lus (userTickets) :", ticketCount.toString());
                userTickets.textContent = ticketCount.toString();
            } catch (error) {
                console.error("Erreur détaillée :", error);
                userTickets.textContent = "0"; // Valeur par défaut
            }
        }
    }
    

    // Fonction pour connecter au wallet
    async function connectWallet() {
        try {
            // Vérifier si MetaMask est installé
            if (!window.ethereum) {
                showNotification("MetaMask n'est pas installé. Veuillez l'installer pour continuer.", true);
                return;
            }
            
            // Demander l'accès au compte
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accounts[0];
            
            // Afficher l'adresse
            walletAddress.textContent = `${userAccount.substring(0, 6)}...${userAccount.substring(userAccount.length - 4)}`;
            walletInfo.style.display = 'block';
            
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
                    
                    console.log("Contrat initialisé avec succès");
                    
                    // Mettre à jour le nombre de tickets
                    await updateTicketCount(); //getTicketBalance
                    
                } catch (error) {
                    console.error("Erreur d'initialisation du contrat:", error);
                    showNotification("Erreur d'initialisation du contrat: " + error.message, true);
                }
            } else {
                console.warn("ethers.js n'est pas chargé. Le contrat ne sera pas initialisé.");
                showNotification("ethers.js n'est pas chargé. Vérifiez votre connexion internet.", true);
            }
            
            return true;
        } catch (error) {
            console.error("Erreur de connexion:", error);
            showNotification("Erreur de connexion: " + error.message, true);
            return false;
        }
    }
    
    // Fonction pour acheter des tickets
    async function buyTickets(amount) {
        // Vérifier si l'utilisateur est connecté
        if (!contract) {
            const connected = await connectWallet();
            if (!connected) return;
        }
        
        try {
            // Calculer le prix avec getTicketPrice au lieu de calculatePrice
            const price = await contract.getTicketPrice(amount);    
            console.log("Prix calculé:", ethers.utils.formatEther(price), "FTN");
            
            // Confirmer l'achat
            const confirmPurchase = confirm(`Prix total: ${ethers.utils.formatEther(price)} FTN pour ${amount} tickets. Confirmer l'achat ?`);
            
            if (confirmPurchase) {
                // Exécuter la transaction
                const tx = await contract.buyTickets(amount, { value: price });
                showNotification(`Transaction envoyée ! Hash: ${tx.hash.substring(0, 10)}...`);
                
                // Attendre que la transaction soit confirmée
                await tx.wait();
                
                // Mettre à jour le nombre de tickets
                await updateTicketCount();
                
                showNotification('Tickets achetés avec succès !');
            }
        } catch (error) {
            console.error("Erreur lors de l'achat:", error);
            showNotification("Erreur: " + error.message, true);
        }
    }
    
    // Initialisation des événements
    function initEvents() {
        // Écouteur d'événement pour le bouton de connexion
        if (connectBtn) {
            connectBtn.addEventListener('click', connectWallet);
        }
        
        // Ajouter des écouteurs d'événements pour les boutons d'achat
        document.querySelectorAll('.buy-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const amount = parseInt(btn.getAttribute('data-amount'));
                if (amount) {
                    await buyTickets(amount);
                }
            });
        });
        
        // Écouter les changements de compte
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', async (accounts) => {
                const newAccount = accounts[0];
                if (newAccount) {
                    userAccount = newAccount;
                    walletAddress.textContent = `${newAccount.substring(0, 6)}...${newAccount.substring(newAccount.length - 4)}`;
                    await updateTicketCount();
                } else {
                    userAccount = null;
                    contract = null;
                    walletAddress.textContent = 'Déconnecté';
                    userTickets.textContent = '-';
                    connectBtn.textContent = 'Connect your wallet';
                    connectBtn.style.backgroundColor = '';
                    walletInfo.style.display = 'none';
                }
            });
            
            // Écouter les changements de réseau
            window.ethereum.on('chainChanged', () => {
                window.location.reload();
            });
        }
    }
    
    // Initialiser les événements
    initEvents();
    
    // Vérifier si déjà connecté via MetaMask
    if (window.ethereum && window.ethereum.selectedAddress) {
        connectWallet();
    }
});