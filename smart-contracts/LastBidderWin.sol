// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title LastBidderWin
 * @dev Smart contract pour un système de cagnottes "last-bidder-win" sur Bahamut
 */
contract LastBidderWin {
    // Structures de données
    struct Clock {
        uint256 id;
        string name;
        uint256 prize;
        uint256 deadline;
        address lastBidder;
        uint256 extensionTime;     // Temps ajouté à chaque participation
        bool isActive;
    }
    
    // Configuration du prix dégressif des tickets
    struct TicketPricing {
        uint256 basePrice;           // Prix unitaire de base
        uint256[] volumeThresholds;  // Seuils de quantité [10, 50, 100]
        uint256[] discountRates;     // Réductions correspondantes en % [5, 10, 15]
    }
    
    // Variables d'état
    mapping(uint256 => Clock) public clocks;
    mapping(address => uint256) public userTickets;
    uint256 public nextClockId;
    TicketPricing public ticketPricing;
    address public owner;
    
    // Événements
    event ClockCreated(uint256 indexed clockId, string name, uint256 initialPrize);
    event TicketsPurchased(address indexed buyer, uint256 amount, uint256 price);
    event TicketUsed(uint256 indexed clockId, address indexed user, uint256 newDeadline);
    event ClockFinalized(uint256 indexed clockId, address winner, uint256 prize);
    
    // Modificateurs
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier clockExists(uint256 clockId) {
        require(clockId < nextClockId, "Clock does not exist");
        _;
    }
    
    /**
     * @dev Initialise le contrat
     * @param _baseTicketPrice Prix de base d'un ticket
     */
    constructor(uint256 _baseTicketPrice) {
        owner = msg.sender;
        nextClockId = 1;
        
        // Initialiser la tarification des tickets avec des valeurs par défaut
        ticketPricing.basePrice = _baseTicketPrice;
        ticketPricing.volumeThresholds = [10, 50, 100];
        ticketPricing.discountRates = [5, 10, 15]; // 5%, 10%, 15% de réduction
    }
    
    /**
     * @dev Configure la tarification dégressive des tickets
     * @param _basePrice Prix unitaire de base
     * @param _volumeThresholds Seuils de quantité pour les réductions
     * @param _discountRates Pourcentages de réduction correspondants
     */
    function setTicketPricing(
        uint256 _basePrice,
        uint256[] calldata _volumeThresholds,
        uint256[] calldata _discountRates
    ) external onlyOwner {
        require(_volumeThresholds.length == _discountRates.length, "Arrays must have same length");
        
        ticketPricing.basePrice = _basePrice;
        ticketPricing.volumeThresholds = _volumeThresholds;
        ticketPricing.discountRates = _discountRates;
    }
    
    /**
     * @dev Calcule le prix total pour un nombre de tickets avec réduction applicable
     * @param _ticketCount Nombre de tickets à acheter
     * @return Prix total après réduction éventuelle
     */
    function calculatePrice(uint256 _ticketCount) public view returns (uint256) {
        uint256 price = ticketPricing.basePrice * _ticketCount;
        uint256 discountRate = 0;
        
        // Trouver le taux de réduction applicable
        for (uint256 i = 0; i < ticketPricing.volumeThresholds.length; i++) {
            if (_ticketCount >= ticketPricing.volumeThresholds[i]) {
                discountRate = ticketPricing.discountRates[i];
            } else {
                break;
            }
        }
        
        // Appliquer la réduction
        if (discountRate > 0) {
            uint256 discount = (price * discountRate) / 100;
            price = price - discount;
        }
        
        return price;
    }
    
    /**
     * @dev Permet à un utilisateur d'acheter des tickets avec prix dégressif
     * @param _amount Nombre de tickets à acheter
     */
    function buyTickets(uint256 _amount) external payable {
        require(_amount > 0, "Must buy at least one ticket");
        
        uint256 price = calculatePrice(_amount);
        require(msg.value >= price, "Insufficient payment");
        
        // Ajouter les tickets au compte de l'utilisateur
        userTickets[msg.sender] += _amount;
        
        // Rembourser l'excédent si nécessaire
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        emit TicketsPurchased(msg.sender, _amount, price);
    }
    
    /**
     * @dev Crée une nouvelle cagnotte/horloge
     * @param _name Nom de l'horloge
     * @param _initialPrize Montant initial du prix
     * @param _deadline Date limite initiale (timestamp)
     * @param _extensionTime Temps ajouté à chaque participation (en secondes)
     */
    function createClock(
        string memory _name,
        uint256 _initialPrize,
        uint256 _deadline,
        uint256 _extensionTime
    ) external payable onlyOwner {
        require(msg.value >= _initialPrize, "Must provide initial prize");
        
        uint256 clockId = nextClockId;
        
        clocks[clockId] = Clock({
            id: clockId,
            name: _name,
            prize: _initialPrize,
            deadline: _deadline,
            lastBidder: address(0),
            extensionTime: _extensionTime,
            isActive: true
        });
        
        nextClockId++;
        
        emit ClockCreated(clockId, _name, _initialPrize);
    }
    
    /**
     * @dev Permet à un utilisateur d'utiliser un ticket pour participer à une cagnotte
     * @param clockId ID de la cagnotte
     */
    function useTicket(uint256 clockId) external clockExists(clockId) {
        Clock storage clock = clocks[clockId];
        
        require(clock.isActive, "Clock is not active");
        require(block.timestamp < clock.deadline, "Clock has expired");
        require(userTickets[msg.sender] > 0, "No tickets available");
        
        // Déduire un ticket
        userTickets[msg.sender] -= 1;
        
        // Mettre à jour l'horloge
        clock.lastBidder = msg.sender;
        clock.deadline = block.timestamp + clock.extensionTime;
        
        emit TicketUsed(clockId, msg.sender, clock.deadline);
    }
    
    /**
     * @dev Finalise une horloge et distribue le prix au dernier enchérisseur
     * @param clockId ID de l'horloge à finaliser
     */
    function finalizeClock(uint256 clockId) external clockExists(clockId) {
        Clock storage clock = clocks[clockId];
        
        require(clock.isActive, "Clock already finalized");
        require(block.timestamp >= clock.deadline, "Clock has not expired yet");
        require(clock.lastBidder != address(0), "No participants");
        
        // Désactiver l'horloge
        clock.isActive = false;
        
        // Transférer le prix au gagnant
        uint256 prize = clock.prize;
        (bool success, ) = clock.lastBidder.call{value: prize}("");
        require(success, "Transfer failed");
        
        emit ClockFinalized(clockId, clock.lastBidder, prize);
    }
    
    /**
     * @dev Permet de consulter le nombre de tickets d'un utilisateur
     * @param _user Adresse de l'utilisateur
     * @return Nombre de tickets disponibles
     */
    function getTicketBalance(address _user) external view returns (uint256) {
        return userTickets[_user];
    }
    
    /**
     * @dev Récupère les informations d'une horloge
     * @param clockId ID de l'horloge
     * @return name Nom de l'horloge
     * @return prize Montant du prix
     * @return deadline Date limite
     * @return lastBidder Adresse du dernier participant
     * @return isActive Statut d'activité
     */
    function getClockInfo(uint256 clockId) external view clockExists(clockId) returns (
        string memory name,
        uint256 prize,
        uint256 deadline,
        address lastBidder,
        bool isActive
    ) {
        Clock storage clock = clocks[clockId];
        return (
            clock.name,
            clock.prize,
            clock.deadline,
            clock.lastBidder,
            clock.isActive
        );
    }
    
    /**
     * @dev Retourne le prix pour acheter un certain nombre de tickets
     * @param _amount Nombre de tickets
     * @return Prix total
     */
    function getTicketPrice(uint256 _amount) external view returns (uint256) {
        return calculatePrice(_amount);
    }
    
    /**
     * @dev Permet au propriétaire de récupérer les fonds du contrat
     * @param _amount Montant à retirer
     */
    function withdraw(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = owner.call{value: _amount}("");
        require(success, "Transfer failed");
    }
    
    /**
     * @dev Receveur de fallback pour accepter des paiements
     */
    receive() external payable {}
}