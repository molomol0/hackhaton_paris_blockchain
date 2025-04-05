// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LastBidderWin {
    // Variables d'état basiques
    address public owner;
    uint256 public ticketPrice;
    mapping(address => uint256) public userTickets;
    
    // Événement pour l'achat de tickets
    event TicketsPurchased(address indexed buyer, uint256 amount);
    
    // Constructeur initialisant le propriétaire et le prix du ticket
    constructor(uint256 _ticketPrice) {
        owner = msg.sender;
        ticketPrice = _ticketPrice;
    }
    
    // Modificateur pour restreindre l'accès au propriétaire
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    // Fonction simple pour acheter des tickets
    function buyTickets(uint256 _amount) external payable {
        // Vérifier que le montant est positif
        require(_amount > 0, "Must buy at least one ticket");
        
        // Vérifier que le paiement est suffisant
        uint256 price = getTicketPrice(_amount);
        require(msg.value >= price, "Insufficient payment");
        
        // Ajouter les tickets au compte de l'utilisateur
        userTickets[msg.sender] += _amount;
        
        // Rembourser l'excédent si nécessaire
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        // Émettre l'événement
        emit TicketsPurchased(msg.sender, _amount);
    }
    
    // Fonction pour obtenir le prix total pour un nombre de tickets
    function getTicketPrice(uint256 _amount) public view returns (uint256) {
        // Simplement multiplication sans réduction
        return ticketPrice * _amount;
    }
    
    // Fonction pour permettre au propriétaire de changer le prix du ticket
    function setTicketPrice(uint256 _newPrice) external onlyOwner {
        ticketPrice = _newPrice;
    }
    
    // Fonction pour vérifier le nombre de tickets d'un utilisateur
    function getTicketBalance(address _user) external view returns (uint256) {
        return userTickets[_user];
    }
    
    // Fonction pour que le propriétaire puisse retirer les fonds
    function withdraw(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Insufficient balance");
        payable(owner).transfer(_amount);
    }
    
    // Fonction de repli pour accepter les paiements
    receive() external payable {}
}