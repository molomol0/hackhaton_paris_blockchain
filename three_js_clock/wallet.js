// On attend que la page soit chargée
document.addEventListener('DOMContentLoaded', () => {
    const connectBtn = document.getElementById('connect-wallet');
    const walletInfo = document.getElementById('wallet-info');
    const walletAddress = document.getElementById('wallet-address');
    const userTickets = document.getElementById('user-tickets');
    
    // Adresse de votre contrat déployé
    const CONTRACT_ADDRESS = "0x1fFaD3D1BB65Aa41ED80958198ad11E26B6F9D58";
    
    // ABI simplifiée du contrat
    const CONTRACT_ABI = [
        "function clocks(uint256) view returns (uint256 id, string name, uint256 prize, uint256 deadline, address lastBidder, uint256 extensionTime, bool isActive)",
        "function userTickets(address) view returns (uint256)",
        "function nextClockId() view returns (uint256)",
        "function buyTickets(uint256 _amount) payable",
        "function useTicket(uint256 clockId)",
        "function calculatePrice(uint256 _ticketCount) view returns (uint256)"
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
            
            // Afficher l'adresse
            walletAddress.textContent = account;
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
                    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
                    
                    console.log("Contrat initialisé avec succès");
                    
                    // Lire le nombre de tickets de l'utilisateur
                    try {
                        const ticketCount = await contract.userTickets(account);
                        userTickets.textContent = ticketCount.toString();
                        console.log("Nombre de tickets:", ticketCount.toString());
                    } catch (error) {
                        console.error("Erreur lors de la lecture des tickets:", error);
                        userTickets.textContent = "Erreur de lecture";
                    }
                    
                    // Ajouter un bouton pour acheter des tickets s'il n'existe pas déjà
                    if (!document.getElementById('buy-tickets')) {
                        const buyBtn = document.createElement('button');
                        buyBtn.id = 'buy-tickets';
                        buyBtn.innerHTML = 'Acheter des tickets';
                        buyBtn.style.backgroundColor = '#4CAF50';
                        buyBtn.style.color = 'white';
                        buyBtn.style.border = 'none';
                        buyBtn.style.padding = '10px 15px';
                        buyBtn.style.borderRadius = '5px';
                        buyBtn.style.marginTop = '20px';
                        buyBtn.style.cursor = 'pointer';
                        walletInfo.appendChild(buyBtn);
                        
                        // Ajouter l'événement de clic pour acheter des tickets
                        buyBtn.addEventListener('click', async () => {
                            const amount = prompt('Combien de tickets souhaitez-vous acheter ?');
                            if (amount && !isNaN(amount) && parseInt(amount) > 0) {
                                try {
                                    const price = await contract.calculatePrice(parseInt(amount));
                                    console.log("Prix calculé:", ethers.utils.formatEther(price), "ETH");
                                    
                                    // Confirmer l'achat
                                    const confirmPurchase = confirm(`Prix total: ${ethers.utils.formatEther(price)} ETH pour ${amount} tickets. Confirmer l'achat ?`);
                                    
                                    if (confirmPurchase) {
                                        const tx = await contract.buyTickets(parseInt(amount), { value: price });
                                        alert(`Transaction envoyée ! Hash: ${tx.hash}`);
                                        
                                        // Attendre que la transaction soit confirmée
                                        await tx.wait();
                                        
                                        // Mettre à jour le nombre de tickets
                                        const newTicketCount = await contract.userTickets(account);
                                        userTickets.textContent = newTicketCount.toString();
                                        
                                        alert('Tickets achetés avec succès !');
                                    }
                                } catch (error) {
                                    console.error("Erreur lors de l'achat:", error);
                                    alert(`Erreur: ${error.message}`);
                                }
                            }
                        });
                    }
                    
                    // Vous pouvez stocker le contrat dans une variable globale pour l'utiliser ailleurs
                    window.contractInstance = contract;
                } catch (error) {
                    console.error("Erreur d'initialisation du contrat:", error);
                    alert(`Erreur d'initialisation du contrat: ${error.message}`);
                }
            } else {
                console.warn("ethers.js n'est pas chargé. Le contrat ne sera pas initialisé.");
                alert("ethers.js n'est pas chargé. Vérifiez votre connexion internet.");
            }
            
            // Écouter les changements de compte
            window.ethereum.on('accountsChanged', async (accounts) => {
                const newAccount = accounts[0];
                if (newAccount) {
                    walletAddress.textContent = newAccount;
                    
                    // Mettre à jour le nombre de tickets pour le nouveau compte
                    if (window.contractInstance) {
                        try {
                            const ticketCount = await window.contractInstance.userTickets(newAccount);
                            userTickets.textContent = ticketCount.toString();
                        } catch (error) {
                            console.error("Erreur lors de la lecture des tickets:", error);
                            userTickets.textContent = "Erreur de lecture";
                        }
                    }
                } else {
                    walletAddress.textContent = 'Déconnecté';
                    userTickets.textContent = '-';
                    connectBtn.textContent = 'Connecter avec MetaMask';
                    connectBtn.style.backgroundColor = '#f6851b';
                    walletInfo.style.display = 'none';
                    
                    // Supprimer le bouton d'achat si présent
                    const buyBtn = document.getElementById('buy-tickets');
                    if (buyBtn) {
                        buyBtn.remove();
                    }
                }
            });
            
            // Écouter les changements de réseau
            window.ethereum.on('chainChanged', (chainId) => {
                // Convertir en décimal
                const networkId = parseInt(chainId, 16);
                let networkName;
                
                // Récupérer le nom du réseau
                switch(networkId) {
                    case 1: networkName = 'Ethereum Mainnet'; break;
                    case 5: networkName = 'Goerli Testnet'; break;
                    case 11155111: networkName = 'Sepolia Testnet'; break;
                    case 137: networkName = 'Polygon Mainnet'; break;
                    case 80001: networkName = 'Mumbai Testnet'; break;
                    default: networkName = `Réseau ID: ${networkId}`;
                }
                
                alert(`Réseau changé: ${networkName}. La page va être rechargée.`);
                window.location.reload();
            });
            
        } catch (error) {
            console.error("Erreur de connexion:", error);
            alert(`Erreur de connexion: ${error.message}`);
        }
    });
});