// On attend que la page soit chargée
document.addEventListener('DOMContentLoaded', () => {
    const connectBtn = document.getElementById('connect-wallet');
    
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