// On attend que la page soit chargée
let contract;
export let wsSocket = null;

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
            
            if (!account) {
                console.error("Aucun compte trouvé");
                return;
            }

            // Changer le texte du bouton
            connectBtn.textContent = 'Wallet Connecté';
            connectBtn.style.backgroundColor = '#21ba45';
            
            const response = await fetch('http://localhost:8000/auth/connect/', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  walletAddress: account
                }),
            }).then((response) => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                else
                    console.log("Connection compte client réussie");
                    return response.json();
            });
            const data = await response;
            sessionStorage.setItem('walletAddress', account);
            sessionStorage.setItem('accessToken', data.access);
            sessionStorage.setItem('refreshToken', data.refresh);
            sessionStorage.setItem('userId', data.userId);

            wsSocket = new WebSocket('ws://localhost:8000/lobby');
            
            wsSocket.onopen = function(event) {
                wsSocket.send(JSON.stringify({
                    event: 'connect',
                    data: {
                        "walletAddress": account,
                        "userId": data.userId 
                    }
                }));
                console.log("Connecté au serveur WebSocket");
            };

            wsSocket.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    console.log("Message received from WebSocket:", data);
                    
                    // Check for event types and handle properly
                    if (data.event === 'update') {
                        console.log("Update received:", data.data);
                        
                        // Update clock time if window.updateClockTimeUI is available
                        if (window.updateClockTimeUI && data.data.remaining_time !== undefined) {
                            console.log("Calling updateClockTimeUI with:", data.data.remaining_time);
                            window.updateClockTimeUI(data.data.remaining_time);
                        } else {
                            console.warn("Cannot update clock UI - missing function or data", {
                                hasFunction: !!window.updateClockTimeUI,
                                hasData: data.data.remaining_time !== undefined,
                                remainingTime: data.data.remaining_time
                            });
                        }
                    }
                    else if (data.event === 'bid_notification') {
                        console.log("Bid notification received:", data.data);
                        
                        // Update clock time if notification includes new time
                        if (window.updateClockTimeUI && data.data.new_time !== undefined) {
                            console.log("Updating clock from bid notification with time:", data.data.new_time);
                            window.updateClockTimeUI(data.data.new_time);
                        }
                        
                        // Show notification about who bid
                        if (data.data.bidder) {
                            const isCurrentUser = data.data.bidder === sessionStorage.getItem('userId');
                            console.log(`Bid by ${isCurrentUser ? 'you' : data.data.bidder}`);
                            
                            // Maybe show a toast notification
                            if (!isCurrentUser) {
                                alert(`User ${data.data.bidder} placed a bid!`);
                            }
                        }
                    }
                    else if (data.event === 'end_clock') {
                        console.log("L'horloge est terminée:", data.data);
                        alert(`L'horloge est terminée! Dernier enchérisseur: ${data.data.last_bidder || 'Aucun'}`);
                        
                        // If the current user is the winner, show confetti
                        if (data.data.last_bidder === sessionStorage.getItem('userId')) {
                            confetti({
                                particleCount: 200,
                                spread: 100,
                                origin: { x: 0.5, y: 0.5 }
                            });
                        }
                    }
                } catch (error) {
                    console.error("Error processing WebSocket message:", error, event.data);
                }
            };

            wsSocket.onclose = function(event) {
                wsSocket = null;
            };
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
    console.log(`Starting recordParticipation for clock ${clockId}`);
    
    // First, ensure we have a contract connection
    if (!contract) {
        try {
            // Initialize the contract
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        } catch (error) {
            console.error("Error initializing contract:", error);
            alert("Could not initialize the contract. Please ensure MetaMask is connected.");
            return false;
        }
    }
    
    try {
        // Check wallet connection
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length === 0) {
            console.error("No wallet connected");
            alert("Please connect your wallet first");
            return false;
        }
        
        const userAddress = accounts[0];
        
        // FIRST: Check if the user has tickets before doing anything else
        console.log("Checking ticket balance for", userAddress);
        const ticketBalance = await contract.getTicketBalance(userAddress);
        
        if (ticketBalance.toNumber() <= 0) {
            alert("You don't have any tickets. Please buy some first.");
            return false;
        }
        
        console.log(`User has ${ticketBalance.toString()} tickets. Proceeding with bid.`);
        
        // Next, check WebSocket connection for updating the UI
        if (wsSocket === null || wsSocket.readyState !== WebSocket.OPEN) {
            console.error("Cannot send WebSocket bid: No connection");
            alert('WebSocket connection not available. Try refreshing the page.');
            return false;
        }
        
        // Get userId from session storage for the WebSocket message
        const userId = sessionStorage.getItem('userId');
        if (!userId) {
            console.error("Cannot send WebSocket bid: No userId");
            alert('User ID not found. Please reconnect your wallet.');
            return false;
        }
        
        // Proceed with the blockchain transaction
        console.log(`Starting blockchain transaction for clock ${clockId}`);
        
        // Create transaction but don't wait for full confirmation
        try {
            // Call the recordParticipation function on the contract
            console.log(`Calling blockchain recordParticipation for clock ${clockId} with address ${userAddress}`);
            const tx = await contract.recordParticipation(clockId, userAddress);
            console.log(`Transaction initiated: ${tx.hash}`);
            
            // Once the transaction is SENT (not yet confirmed), send the WebSocket bid
            // This updates the UI immediately without waiting for blockchain confirmation
            const bidMessage = JSON.stringify({
                event: 'bid', 
                data: { 
                    userId: userId,
                    transactionHash: tx.hash 
                }
            });
            console.log('Sending bid WebSocket message:', bidMessage);
            wsSocket.send(bidMessage);
            
            // Show confetti effect after sending bid message
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { x: 0.5, y: 0.6 }
                });
            }
            
            // Wait for confirmation in the background
            tx.wait().then(receipt => {
                console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
                
                // Optional: Send confirmation to WebSocket
                if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
                    wsSocket.send(JSON.stringify({
                        event: 'transaction_confirmed',
                        data: {
                            userId: userId,
                            transactionHash: tx.hash,
                            clockId: clockId
                        }
                    }));
                }
            }).catch(error => {
                console.error("Transaction confirmation failed:", error);
                // Optionally notify the user
            });
            
            return true;
        } catch (txError) {
            console.error("Transaction error:", txError);
            alert("Error sending transaction: " + txError.message);
            return false;
        }
    } catch (error) {
        console.error("Error recording participation:", error);
        alert("Error using ticket: " + error.message);
        return false;
    }
}

export function getWebSocket() {
    console.log("getWebSocket called: ", wsSocket);
    return wsSocket;

}

// Exposer la fonction
window.recordParticipation = recordParticipation;

// Fonction pour finaliser une horloge
async function finalizeClock(clockId) {
    try {
        // Vérifier si MetaMask est installé
        if (!window.ethereum) {
            alert("MetaMask n'est pas installé. Veuillez l'installer pour continuer.");
            return false;
        }
        
        // Demander l'accès au compte s'il n'est pas déjà connecté
        let accounts;
        try {
            accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length === 0) {
                accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            }
        } catch (error) {
            console.error("Erreur lors de la connexion au wallet:", error);
            alert("Erreur: Impossible de se connecter au wallet");
            return false;
        }
        
        const account = accounts[0];
        
        // Vérifier si ethers.js est disponible
        if (!window.ethers) {
            alert("ethers.js n'est pas chargé. Vérifiez votre connexion internet.");
            return false;
        }
        
        // Initialiser le contrat si nécessaire
        if (!contract) {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            window.contract = contract;
        }
        
        console.log(`Finalisation de l'horloge ${clockId}...`);
        
        // Appeler la fonction finalizeClock du contrat
        const tx = await contract.finalizeClock(clockId);
        console.log(`Transaction envoyée: ${tx.hash}`);
        
        // Attendre la confirmation de la transaction
        await tx.wait();
        console.log("Horloge finalisée avec succès!");
        alert("Horloge finalisée avec succès!");
        
        return true;
    } catch (error) {
        console.error("Erreur lors de la finalisation de l'horloge:", error);
        alert(`Erreur lors de la finalisation de l'horloge: ${error.message || error}`);
        return false;
    }
}

// Exposer la fonction globalement
window.finalizeClock = finalizeClock;
