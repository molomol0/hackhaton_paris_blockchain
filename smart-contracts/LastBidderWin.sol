// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LastBidderWin {
    address public owner;
    uint256 public ticketPrice;
    uint256 public clocksNum;
    
    struct Clock {
        uint256 id;
        uint256 prize;
        address lastBidder;
        bool isActive;
        bool isFinalized;
    }

    mapping(address => uint256) public userTickets;
    mapping(uint256 => Clock) public clocks;
    uint256 public nextClockId = 1;
    
    event TicketsPurchased(address indexed buyer, uint256 amount);
    event ClockCreated(uint256 indexed clockId, uint256 prize);
    event ParticipationRecorded(uint256 indexed clockId, address indexed participant);
    event ClockFinalized(uint256 indexed clockId, address winner, uint256 prize);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier clockExists(uint256 clockId) {
        require(clockId < nextClockId, "Clock does not exist");
        _;
    }
    
    constructor() payable {
    // Initialisation des variables d'état standard
    owner = msg.sender;
    ticketPrice = 250000000000000000; // 0.25 FTN
    nextClockId = 1;
    
    // Vérification que suffisamment de FTN ont été envoyés
    uint256 mainClockPrize = 1; // 1 FTN pour l'horloge principale
    require(msg.value >= mainClockPrize, "Must provide prize amount for main clock (20 FTN)");
    
    // Création de l'horloge principale
    uint256 clockId = nextClockId;
    
    clocks[clockId] = Clock({
        id: clockId,
        prize: mainClockPrize,
        lastBidder: address(0),
        isActive: true,
        isFinalized: false
    });
    
    // Incrémentation de l'ID pour les futures horloges
    clocksNum++;
    nextClockId++;
    
    // Émission de l'événement de création
    emit ClockCreated(clockId, mainClockPrize);
}
    
    function buyTickets(uint256 _amount) external payable {
        require(_amount > 0, "Must buy at least one ticket");
        
        uint256 price = getTicketPrice(_amount);
        require(msg.value >= price, "Insufficient payment");
        
        userTickets[msg.sender] += _amount;
      
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        emit TicketsPurchased(msg.sender, _amount);
    }
    
    function createClock(uint256 _prize) external payable {
        require(msg.value >= _prize, "Must provide the prize amount");
        
        uint256 clockId = nextClockId;
        
        clocks[clockId] = Clock({
            id: clockId,
            prize: _prize,
            lastBidder: address(0),
            isActive: true,
            isFinalized: false
        });
        
        nextClockId++;
        clocksNum++;
        
        emit ClockCreated(clockId, _prize);
    }
    
    function recordParticipation(uint256 clockId, address participant) external clockExists(clockId) {
        Clock storage clock = clocks[clockId];
        
        require(clock.isActive, "Clock is not active");
        require(!clock.isFinalized, "Clock is already finalized");
        require(userTickets[participant] > 0, "User has no tickets");
        
        userTickets[participant]--;
        
        clock.prize += ticketPrice;
        clock.lastBidder = participant;
        
        emit ParticipationRecorded(clockId, participant);
    }
    
    function finalizeClock(uint256 clockId) external clockExists(clockId) {
        Clock storage clock = clocks[clockId];

        require(clock.isActive, "Clock is not active");
        require(!clock.isFinalized, "Clock is already finalized");

        // Vérifier qu'il y a eu au moins un participant
        require(clock.lastBidder != address(0), "No participants in the clock");

        clock.isActive = false;
        clock.isFinalized = true;
        clocksNum--;

        uint256 prize = clock.prize;
        address payable winner = payable(clock.lastBidder);

        // Transférer le prix au gagnant
        (bool success, ) = winner.call{value: prize}("");
        require(success, "Transfer failed");

        emit ClockFinalized(clockId, winner, prize);
    }
    
    function getTicketPrice(uint256 _amount) public view returns (uint256) {
        return ticketPrice * _amount;
    }
    
    function getTicketBalance(address _user) external view returns (uint256) {
        return userTickets[_user];
    }
    
    function withdraw(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Insufficient balance");
        payable(owner).transfer(_amount);
    }
    
    receive() external payable {}
}