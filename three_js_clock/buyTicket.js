document.addEventListener('DOMContentLoaded', () => {
    const connectBtn = document.getElementById('connect-wallet');
    const walletInfo = document.getElementById('wallet-info');
    const walletAddress = document.getElementById('wallet-address');
    const userTickets = document.getElementById('user-tickets');
    const notification = document.getElementById('notification');
    
    // Adresse de votre contrat déployé
    const CONTRACT_ADDRESS = "0xebCAc112eF871f9C2B127E1f347d70Ce6126Fa0C";
    
    // ABI simplifiée du contrat
    const CONTRACT_ABI = [
        "function clocks(uint256) view returns (uint256 id, string name, uint256 prize, uint256 deadline, address lastBidder, uint256 extensionTime, bool isActive)",
        "function userTickets(address) view returns (uint256)",
        "function nextClockId() view returns (uint256)",
        "function buyTickets(uint256 _amount) payable",
        "function useTicket(uint256 clockId)",
        "function calculatePrice(uint256 _ticketCount) view returns (uint256)"
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
                const ticketCount = await contract.userTickets(userAccount);
                userTickets.textContent = ticketCount.toString();
            } catch (error) {
                console.error("Erreur lors de la lecture des tickets:", error);
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
                    await updateTicketCount();
                    
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
            // Calculer le prix
            const price = await contract.calculatePrice(amount);
            console.log("Prix calculé:", ethers.utils.formatEther(price), "ETH");
            
            // Confirmer l'achat
            const confirmPurchase = confirm(`Prix total: ${ethers.utils.formatEther(price)} ETH pour ${amount} tickets. Confirmer l'achat ?`);
            
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