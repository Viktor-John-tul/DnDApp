import Foundation
import SwiftData

enum RollMode {
    case normal
    case advantage      // Roll 2, keep Highest
    case disadvantage   // Roll 2, keep Lowest
}
@Model
class RPGCharacter {
    var name: String
    var characterClass: String
    var level: Int
    
    // Stats
    var strength: Int
    var dexterity: Int
    var constitution: Int
    var intelligence: Int
    var wisdom: Int
    var charisma: Int
    
    // Mechanics
    var isSpecialRuleEnabled: Bool
    var proficientSkills: [String] = []
    var proficientSavingThrows: [String] = []
    @Attribute(.externalStorage) var photoData: Data?
    
    // DEMON SLAYER SPECIFICS
    var breathingStyleName: String = ""
    var breathingForms: [BreathingForm] = []
    
    // NEW: BREATHS MECHANIC
    var currentBreaths: Int = 100
    var maxBreaths: Int = 100
    var currentOverdraftDC: Int = 15
    
    // NEW: HEALTH MECHANIC
    var currentHP: Int = 0
    var healingSurges: Int = 3 // 3 uses between rests
    
    // DEATH SAVES
    var deathSaveSuccesses: Int = 0
    var deathSaveFailures: Int = 0
    
    var gold: Int = 0
    var inventory: [InventoryItem] = []
    var currentWeight: Double {
            inventory.reduce(0) { $0 + ($1.weight * Double($1.quantity)) }
        }
    var maxWeight: Double {
            return 80.0 + Double(strength * 2)
        }
    var isEncumbered: Bool {
        return currentWeight > maxWeight
    }
    
    // NEW: CUSTOM ACTIONS (For things like "Punch", "Potion", etc.)
    var customActions: [CombatAction] = []
    
    // Active attack buff state
    var activeBuffFormID: UUID?
    var activeBuffName: String?
    var activeBuffDiceCount: Int?
    var activeBuffDiceFace: Int?
    var activeBuffRoundsRemaining: Int?
    
    var age: String = ""
        var height: String = ""
        var weight: String = ""
        var eyes: String = ""
        var skin: String = ""
        var hair: String = ""
        
        var personalityTraits: String = ""
        var ideals: String = ""
        var bonds: String = ""
        var flaws: String = ""
        
        var backstory: String = ""
        var notes: String = ""
    
    
    
    init(name: String = "", characterClass: String = "", level: Int = 1) {
        self.name = name
        self.characterClass = characterClass
        self.level = level
        self.strength = 14
        self.dexterity = 14
        self.constitution = 13
        self.intelligence = 10
        self.wisdom = 12
        self.charisma = 10
        self.isSpecialRuleEnabled = false
        self.proficientSkills = []
        self.proficientSavingThrows = []
        self.breathingForms = []
        self.customActions = []
        self.currentBreaths = 100
        self.maxBreaths = 100
        self.currentOverdraftDC = 15
        
        let conMod = (13 - 10) / 2
        self.currentHP = (8 + conMod) * level
        self.healingSurges = 3
        self.deathSaveSuccesses = 0
        self.deathSaveFailures = 0
        
        //inventory
        self.inventory = []
        self.gold = 0
        //bacstory
        self.age = ""; self.height = ""; self.weight = ""
        self.eyes = ""; self.skin = ""; self.hair = ""
        self.personalityTraits = ""; self.ideals = ""; self.bonds = ""; self.flaws = ""
        self.backstory = ""; self.notes = ""
        // Buff state
        self.activeBuffFormID = nil; self.activeBuffName = nil
        self.activeBuffDiceCount = nil; self.activeBuffDiceFace = nil
        self.activeBuffRoundsRemaining = nil
    }
}

// NEW: Item Struct
struct InventoryItem: Codable, Identifiable, Hashable {
    var id = UUID()
    var name: String
    var description: String
    var quantity: Int = 1
    var weight: Double = 0.0
}


struct BreathingForm: Codable, Identifiable, Hashable {
    var id = UUID()
    var name: String = ""
    var description: String = ""
    
    // Mechanics
    var requiresAttackRoll: Bool = true
    var durationRounds: Int = 0  // <--- RENAMED from 'duration' to match your View
    
    // Dice settings
    var diceCount: Int = 1
    var diceFace: Int = 6
    
    var effectType: FormEffectType = .damage
}

// MARK: - UPDATED ENUM (Restored missing cases)
enum FormEffectType: String, Codable, CaseIterable {
    case damage = "Deal Damage"
    case attackBuff = "Attack Buff" // <--- Added back
    case defenseBuff = "Defense Buff" // <--- Added back
    case utility = "Utility" // <--- Added back
}

// NEW: Struct for Custom Actions
struct CombatAction: Codable, Identifiable {
    var id = UUID()
    var name: String
    var description: String
    var type: ActionType
}

// The 4 Categories you requested
enum ActionType: String, Codable, CaseIterable {
    case main = "Main Action"
    case bonus = "Bonus Action"
    case reaction = "Reaction"
    case free = "Free Action"
}
