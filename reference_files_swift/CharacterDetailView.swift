import SwiftUI
import SwiftData
import UIKit

// MARK: - Color Extension for Dark Mode Support
extension Color {
    static let cardBackground = Color(UIColor { $0.userInterfaceStyle == .dark ? .secondarySystemGroupedBackground : .white })
}

struct CharacterDetailView: View {
    let character: RPGCharacter
    @State private var selectedPage = 0
    
    // Dice Roller State
    @State private var showDiceRoller = false
    @State private var rollTitle = ""
    @State private var rollCount = 1
    @State private var rollFace = 20
    @State private var rollModifier = 0
    @State private var rollMode: RollMode = .normal
    @State private var rollID = UUID()
    @State private var rollCompletion: ((Int) -> Void)?
    
    // Hit Confirmation State
    @State private var showHitConfirmation = false
    @State private var pendingDamageRoll: (() -> Void)?
    
    // Sheets State
    @State private var showAddActionSheet = false
    @State private var showAddItemSheet = false
    @State private var showEditBioSheet = false
    @State private var showEditNotesSheet = false
    @State private var showAddFormSheet = false
    
    // Combined roller state (restored)
    @State private var showCombinedRoller = false
    @State private var combinedTitle = ""
    @State private var combinedGroups: [CombinedDiceGroup] = []
    @State private var combinedModifier = 0
    @State private var combinedCompletion: ((Int) -> Void)?
    
    // Health Popup State
    @State private var showHealthPopup = false
    @State private var healthChangeMode: HealthChangeMode = .damage
    @State private var healthInput = ""
    
    enum HealthChangeMode { case damage, heal }
    
    var body: some View {
        ZStack {
            TabView(selection: $selectedPage) {
                // PAGE 0: MAIN STATS
                MainStatsPage(character: character, onRoll: { title, mod, mode in
                    triggerRoll(title: title, count: 1, face: 20, mod: mod, mode: mode)
                }, onHealthTap: {
                    showHealthPopup = true
                })
                .tag(0)
                
                // PAGE 1: COMBAT
                CombatPage(
                    character: character,
                    onRoll: { title, count, face, mod, completion in
                        triggerRoll(title: title, count: count, face: face, mod: mod, mode: .normal, completion: completion)
                    },
                    onConfirmHit: { damageAction in
                        pendingDamageRoll = damageAction
                        showHitConfirmation = true
                    },
                    onAddAction: { showAddActionSheet = true },
                    onAddForm: { showAddFormSheet = true },
                    onCombinedRoll: { title, groups, mod, completion in
                        triggerCombinedRoll(title: title, groups: groups, mod: mod, completion: completion)
                    }
                )
                .tag(1)
                
                // PAGE 2: INVENTORY
                InventoryPage(character: character, onAddItem: { showAddItemSheet = true })
                .tag(2)
                
                // PAGE 3: BIO
                BioPage(character: character, onEdit: { showEditBioSheet = true })
                .tag(3)
                
                // PAGE 4: NOTES
                NotesPage(character: character, onEdit: { showEditNotesSheet = true })
                .tag(4)
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .always))
            
            // DICE ROLLER OVERLAY
            if showDiceRoller {
                DiceRollerView(
                    title: rollTitle,
                    diceCount: rollCount,
                    diceFace: rollFace,
                    modifier: rollModifier,
                    rollMode: rollMode
                ) { result in
                    withAnimation { showDiceRoller = false }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { rollCompletion?(result) }
                }
                .zIndex(2).id(rollID)
            }
            
            // Combined roller overlay (restored)
            if showCombinedRoller {
                CombinedDiceRollerView(
                    title: combinedTitle,
                    groups: combinedGroups,
                    modifier: combinedModifier
                ) { result in
                    withAnimation { showCombinedRoller = false }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { combinedCompletion?(result) }
                }
                .zIndex(3)
            }
            
            // Health Management Overlay
            if showHealthPopup {
                Color.black.opacity(0.4).ignoresSafeArea()
                    .onTapGesture { withAnimation { showHealthPopup = false } }
                    .zIndex(4)
                
                HealthPopupView(character: character, onClose: {
                    withAnimation { showHealthPopup = false }
                }, onRollSurge: {
                    // Logic for 1d12 healing surge
                    if character.healingSurges > 0 {
                        character.healingSurges -= 1
                        triggerRoll(title: "Healing Surge", count: 1, face: 12, mod: 0, mode: .normal) { result in
                            let oldHP = character.currentHP
                            let maxHP = (8 + (character.constitution - 10) / 2) * character.level
                            character.currentHP = min(character.currentHP + result, maxHP)
                            // Optional: Show a little toast? For now the roller shows the result.
                        }
                    }
                })
                .zIndex(5)
                .transition(.scale)
            }
            
            // Death Screen Overlay
            if character.currentHP <= 0 {
                DeathScreenView(character: character)
                    .zIndex(10) // Highest priority
                    .transition(.opacity)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle(character.name)
        .background(Color(UIColor.systemGroupedBackground))
        
        // --- ALERTS ---
        .alert("Did the attack hit?", isPresented: $showHitConfirmation) {
            Button("Miss", role: .cancel) { }
            Button("Hit", role: .none) {
                pendingDamageRoll?()
            }
        }
        
        // --- SHEETS ---
        .sheet(isPresented: $showAddActionSheet) {
            AddActionView { newAction in character.customActions.append(newAction) }
        }
        .sheet(isPresented: $showAddItemSheet) {
            AddInventoryItemView { newItem in character.inventory.append(newItem) }
        }
        .sheet(isPresented: $showEditBioSheet) {
            EditBioView(character: character)
        }
        .sheet(isPresented: $showEditNotesSheet) {
            EditNotesView(character: character)
        }
        .sheet(isPresented: $showAddFormSheet) {
            AddBreathingFormView { newForm in character.breathingForms.append(newForm) }
        }
    }
    
    // Helper to trigger the dice roller
    func triggerRoll(title: String, count: Int, face: Int, mod: Int, mode: RollMode, completion: @escaping (Int) -> Void = { _ in }) {
        rollTitle = title
        rollCount = count
        rollFace = face
        rollModifier = mod
        rollMode = mode
        rollCompletion = completion
        rollID = UUID()
        withAnimation { showDiceRoller = true }
    }
    
    // Helper to trigger combined roller (restored)
    func triggerCombinedRoll(title: String, groups: [CombinedDiceGroup], mod: Int, completion: @escaping (Int) -> Void = { _ in }) {
        combinedTitle = title
        combinedGroups = groups
        combinedModifier = mod
        combinedCompletion = completion
        withAnimation { showCombinedRoller = true }
    }
}

// MARK: - PAGE 0: MAIN STATS PAGE
struct MainStatsPage: View {
    let character: RPGCharacter
    var onRoll: (String, Int, RollMode) -> Void
    var onHealthTap: () -> Void
    
    let allSkills = [
        "Acrobatics (Dex)", "Animal Handling (Wis)", "Arcana (Int)", "Athletics (Str)",
        "Deception (Cha)", "History (Int)", "Insight (Wis)", "Intimidation (Cha)",
        "Investigation (Int)", "Medicine (Wis)", "Nature (Int)", "Perception (Wis)",
        "Performance (Cha)", "Persuasion (Cha)", "Religion (Int)", "Sleight of Hand (Dex)",
        "Stealth (Dex)", "Survival (Wis)"
    ]
    
    let encumberedSkills = ["Acrobatics", "Athletics", "Performance", "Stealth"]
    
    func getMod(_ score: Int) -> Int { return (score - 10) / 2 }
    
    var ac: Int { 10 + getMod(character.dexterity) }
    var proficiency: Int { (character.level - 1) / 4 + 2 }
    var maxHP: Int { (8 + getMod(character.constitution)) * character.level }
    // Initiative is usually just the DEX modifier
    var initiative: Int { getMod(character.dexterity) }
    
    var speed: String { character.isEncumbered ? "15 ft" : "30 ft" }
    var speedColor: Color { character.isEncumbered ? .orange : .green }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header (Modified)
                HStack(spacing: 20) {
                    if let data = character.photoData, let uiImage = UIImage(data: data) {
                        Image(uiImage: uiImage).resizable().scaledToFill()
                            .frame(width: 90, height: 90).clipShape(Circle())
                            .shadow(radius: 4).overlay(Circle().stroke(Color.white, lineWidth: 3))
                    } else {
                        Image(systemName: "person.circle.fill").resizable()
                            .frame(width: 90, height: 90).foregroundStyle(.gray.opacity(0.3))
                    }
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text(character.name).font(.title).bold()
                        Text("Lvl \(character.level) \(character.characterClass)").font(.subheadline).foregroundStyle(.secondary)
                        
                        // NEW: Health Button next to name
                        Button(action: onHealthTap) {
                            HStack(spacing: 6) {
                                Image(systemName: "heart.fill").foregroundStyle(.red)
                                Text("\(character.currentHP) / \(maxHP)")
                                    .font(.headline).bold().foregroundStyle(.primary)
                            }
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .background(Color.red.opacity(0.1)).cornerRadius(20)
                        }
                        .padding(.top, 4)
                    }
                    Spacer()
                }
                .padding(.horizontal).padding(.top)
                
                // Vitals (Modified: Init instead of HP)
                HStack(spacing: 12) {
                    VitalBox(label: "AC", value: "\(ac)", icon: "shield.fill", color: .blue)
                    // Replaced HP with Initiative
                    VitalBox(label: "INIT", value: initiative >= 0 ? "+\(initiative)" : "\(initiative)", icon: "hare.fill", color: .purple)
                    VitalBox(label: "SPD", value: speed, icon: "figure.run", color: speedColor)
                    VitalBox(label: "PROF", value: "+\(proficiency)", icon: "star.fill", color: .yellow)
                }
                .padding(.horizontal)
                
                // Conditions
                VStack(alignment: .leading, spacing: 8) {
                    Text("Effects").font(.caption).bold().foregroundStyle(.secondary).padding(.leading)
                    VStack(spacing: 0) {
                        if character.isEncumbered {
                            EffectRow(name: "Encumbered", description: "Half Speed, Disadv. on Phys. Skills", icon: "scalemass.fill", color: .red)
                            if character.isSpecialRuleEnabled { Divider().padding(.leading, 40) }
                        }
                        
                        if character.isSpecialRuleEnabled {
                            EffectRow(name: character.breathingStyleName, description: "Breathing Style", icon: "flame.fill", color: .orange)
                        } else if !character.isEncumbered {
                            Text("No active effects").foregroundStyle(.secondary).padding()
                        }
                    }
                    .background(Color.white).cornerRadius(12).shadow(color: .black.opacity(0.05), radius: 2, y: 1)
                }
                .padding(.horizontal)
                
                // Attributes
                VStack(alignment: .leading) {
                    Text("Attributes & Saves").font(.caption).bold().foregroundStyle(.secondary).padding(.leading)
                    LazyVGrid(columns: [GridItem(), GridItem(), GridItem()], spacing: 10) {
                        ForEach(["STR", "DEX", "CON", "INT", "WIS", "CHA"], id: \.self) { stat in
                            let isDex = (stat == "DEX")
                            let isDisadvantage = isDex && character.isEncumbered
                            
                            AttributeBoxWrapper(
                                stat: stat,
                                character: character,
                                isDisadvantage: isDisadvantage,
                                onRoll: onRoll
                            )
                        }
                    }
                }
                .padding(.horizontal)
                
                // Skills
                VStack(alignment: .leading, spacing: 0) {
                    Text("Skills").font(.caption).bold().foregroundStyle(.secondary).padding(.leading).padding(.bottom, 8)
                    VStack(spacing: 1) {
                        ForEach(allSkills, id: \.self) { skillString in
                            let cleanName = skillString.components(separatedBy: " (").first ?? ""
                            let hasDisadvantage = character.isEncumbered && encumberedSkills.contains(cleanName)
                            
                            SkillRow(skillString: skillString, character: character, proficiencyBonus: proficiency, getMod: getMod)
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    let mod = calculateSkillMod(skillString: skillString, character: character, profBonus: proficiency, getMod: getMod)
                                    onRoll(cleanName, mod, hasDisadvantage ? .disadvantage : .normal)
                                }
                                .overlay(
                                    HStack {
                                        Spacer()
                                        if hasDisadvantage {
                                            Text("DIS").font(.caption2).bold().foregroundStyle(.red).padding(.trailing, 40)
                                        }
                                    }
                                )
                        }
                    }
                    .background(Color(UIColor.systemGray5))
                    .cornerRadius(12)
                }
                .padding(.horizontal)
                
                Spacer(minLength: 50)
            }
        }
    }
    
    func calculateSkillMod(skillString: String, character: RPGCharacter, profBonus: Int, getMod: (Int) -> Int) -> Int {
        let attributeKey = skillString.components(separatedBy: "(").last?.replacingOccurrences(of: ")", with: "") ?? ""
        var score = 10
        switch attributeKey {
        case "Str": score = character.strength
        case "Dex": score = character.dexterity
        case "Con": score = character.constitution
        case "Int": score = character.intelligence
        case "Wis": score = character.wisdom
        case "Cha": score = character.charisma
        default: break
        }
        var total = getMod(score)
        if character.proficientSkills.contains(skillString) { total += profBonus }
        return total
    }
}

// MARK: - COMPONENTS

struct AttributeBoxWrapper: View {
    let stat: String
    let character: RPGCharacter
    let isDisadvantage: Bool
    let onRoll: (String, Int, RollMode) -> Void
    
    var score: Int {
        switch stat {
        case "STR": return character.strength
        case "DEX": return character.dexterity
        case "CON": return character.constitution
        case "INT": return character.intelligence
        case "WIS": return character.wisdom
        case "CHA": return character.charisma
        default: return 10
        }
    }
    
    func getMod(_ s: Int) -> Int { (s - 10) / 2 }
    
    var body: some View {
        AttributeBox(
            label: stat,
            score: score,
            mod: getMod(score),
            save: getMod(score),
            isProficient: character.proficientSavingThrows.contains(stat.capitalized),
            onTap: { type, val in
                let mode: RollMode = (type.contains("Save") && isDisadvantage) ? .disadvantage : .normal
                onRoll(type, val, mode)
            }
        )
    }
}

struct AttributeBox: View {
    let label: String
    let score: Int
    let mod: Int
    let save: Int
    let isProficient: Bool
    
    var onTap: (String, Int) -> Void
    
    var modString: String { mod >= 0 ? "+\(mod)" : "\(mod)" }
    var saveString: String { save >= 0 ? "+\(save)" : "\(save)" }
    
    var body: some View {
        VStack(spacing: 6) {
            Text(label).font(.caption2).bold().foregroundStyle(.secondary)
            HStack(spacing: 8) {
                Button(action: { onTap("\(label) Check", mod) }) {
                    VStack(spacing: 0) {
                        Text(modString).font(.headline).bold().foregroundStyle(.primary)
                        Text("MOD").font(.system(size: 7)).bold().foregroundStyle(.secondary)
                    }
                }
                Rectangle().fill(Color.gray.opacity(0.3)).frame(width: 1, height: 20)
                Button(action: { onTap("\(label) Save", save) }) {
                    VStack(spacing: 0) {
                        HStack(spacing: 2) {
                            Text(saveString).font(.headline).bold().foregroundStyle(.red)
                            if isProficient { Circle().fill(Color.red).frame(width: 4, height: 4).offset(y: -4) }
                        }
                        Text("SAVE").font(.system(size: 7)).bold().foregroundStyle(.red.opacity(0.7))
                    }
                }
            }
            Text("\(score)").font(.system(size: 10, weight: .bold)).foregroundStyle(.gray)
                .padding(.horizontal, 8).padding(.vertical, 2).background(Color.gray.opacity(0.1)).clipShape(Capsule())
        }
        .frame(maxWidth: .infinity).padding(.vertical, 10).background(Color.white).cornerRadius(12).shadow(color: .black.opacity(0.05), radius: 2, y: 1)
    }
}

struct VitalBox: View {
    let label: String; let value: String; let icon: String; let color: Color
    var body: some View {
        VStack(spacing: 5) {
            Image(systemName: icon).font(.caption).foregroundStyle(color)
            Text(value).font(.title3).bold()
            Text(label).font(.system(size: 8)).textCase(.uppercase).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity).padding(.vertical, 10).background(Color.white).cornerRadius(10).shadow(radius: 1)
    }
}

struct EffectRow: View {
    let name: String; let description: String; let icon: String; let color: Color
    var body: some View {
        HStack {
            Image(systemName: icon).foregroundStyle(color)
            Text(name).font(.subheadline).bold()
            Spacer()
            Text(description).font(.caption).foregroundStyle(.secondary)
        }.padding()
    }
}

struct SkillRow: View {
    let skillString: String; let character: RPGCharacter; let proficiencyBonus: Int; let getMod: (Int) -> Int
    var calculatedBonus: Int {
        let attributeKey = skillString.components(separatedBy: "(").last?.replacingOccurrences(of: ")", with: "") ?? ""
        var score = 10
        switch attributeKey {
        case "Str": score = character.strength
        case "Dex": score = character.dexterity
        case "Con": score = character.constitution
        case "Int": score = character.intelligence
        case "Wis": score = character.wisdom
        case "Cha": score = character.charisma
        default: break
        }
        var total = getMod(score)
        if character.proficientSkills.contains(skillString) { total += proficiencyBonus }
        return total
    }
    var body: some View {
        HStack {
            Image(systemName: character.proficientSkills.contains(skillString) ? "circle.fill" : "circle")
                .font(.caption2).foregroundStyle(character.proficientSkills.contains(skillString) ? .orange : .gray.opacity(0.3))
            Text(skillString.components(separatedBy: " (").first ?? "").font(.subheadline)
            Spacer()
            Text(calculatedBonus >= 0 ? "+\(calculatedBonus)" : "\(calculatedBonus)")
                .font(.headline).foregroundStyle(character.proficientSkills.contains(skillString) ? .orange : .primary)
        }.padding().background(Color.white)
    }
}

// MARK: - PAGE 1: COMBAT PAGE
struct CombatPage: View {
    let character: RPGCharacter
    var onRoll: (String, Int, Int, Int, @escaping (Int) -> Void) -> Void
    var onConfirmHit: (@escaping () -> Void) -> Void
    var onAddAction: () -> Void
    var onAddForm: () -> Void
    var onCombinedRoll: (String, [CombinedDiceGroup], Int, @escaping (Int) -> Void) -> Void
    
    var activeBuff: (name: String, count: Int, face: Int, rounds: Int)? {
        if let rounds = character.activeBuffRoundsRemaining, rounds > 0,
           let count = character.activeBuffDiceCount, let face = character.activeBuffDiceFace {
            return (character.activeBuffName ?? "Attack Buff", count, face, rounds)
        }
        return nil
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Breaths Counter
                VStack(spacing: 10) {
                    HStack {
                        Text("Breaths").font(.headline).foregroundStyle(.secondary)
                        Spacer()
                        Text("\(character.currentBreaths) / \(character.maxBreaths)")
                            .font(.title2).bold().fontDesign(.monospaced)
                            .foregroundStyle(character.currentBreaths < 0 ? .red : .cyan)
                    }
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 8).fill(Color.gray.opacity(0.2)).frame(height: 12)
                            if character.currentBreaths > 0 {
                                RoundedRectangle(cornerRadius: 8).fill(Color.cyan)
                                    .frame(width: CGFloat(character.currentBreaths) / CGFloat(character.maxBreaths) * geometry.size.width, height: 12)
                            }
                        }
                    }.frame(height: 12)
                    
                    if character.currentBreaths < 0 {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                            Text("Overexertion! Next Save DC: \(character.currentOverdraftDC)")
                        }.font(.caption).bold().foregroundStyle(.red).padding(6).background(Color.red.opacity(0.1)).cornerRadius(6)
                    }
                    
                    HStack {
                        Button(action: { modifyBreaths(-10) }) { Label("Use 10", systemImage: "minus").font(.caption).bold() }.buttonStyle(.bordered)
                        Spacer()
                        Button(action: { modifyBreaths(10) }) { Label("Recover 10", systemImage: "plus").font(.caption).bold() }.buttonStyle(.bordered)
                    }
                }
                .padding().background(Color.white).cornerRadius(12).shadow(color: .black.opacity(0.05), radius: 2, y: 1).padding(.horizontal)
                
                if let buff = activeBuff {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Label("Active Attack Buff", systemImage: "wand.and.stars")
                                .font(.headline)
                                .foregroundStyle(.purple)
                            Spacer()
                            Text("\(buff.rounds) rds left").font(.caption).bold()
                        }
                        HStack {
                            Text(buff.name).bold()
                            Spacer()
                            Text("+\(buff.count)d\(buff.face) to damage")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        HStack {
                            Button("Spend 1 round") { consumeAttackBuffRound() }
                                .buttonStyle(.borderedProminent)
                                .tint(.purple)
                            Button("Clear") { clearAttackBuff() }
                                .buttonStyle(.bordered)
                        }
                    }
                    .padding()
                    .background(Color.white)
                    .cornerRadius(12)
                    .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
                    .padding(.horizontal)
                }
                
                // Actions List
                VStack(alignment: .leading, spacing: 20) {
                    HStack {
                        Text("Actions").font(.title2).bold()
                        Spacer()
                        Menu {
                            Button("Add Custom Action", action: onAddAction)
                            Button("Create Breathing Form", action: onAddForm)
                        } label: {
                            Text("Edit / Add").font(.subheadline).bold()
                        }
                    }
                    .padding(.horizontal)
                    
                    // Main Actions
                    ActionSection(title: "Main Actions", icon: "sword.fill", color: .red) {
                        // Standard Attack per rules: Attack = 1d20 + STR + PROF, Damage = 1d8 + STR
                        Button(action: {
                            func abilityMod(_ score: Int) -> Int { (score - 10) / 2 }
                            let profBonus = (character.level - 1) / 4 + 2
                            let strMod = abilityMod(character.strength)
                            let dexMod = abilityMod(character.dexterity)
                            // Standard attack uses STR for attack roll (to hit)
                            let attackMod = dexMod + profBonus
                            onRoll("Standard Attack", 1, 20, attackMod) { _ in
                                onConfirmHit {
                                    rollDamageWithBuff(title: "Standard Attack Damage", diceCount: 1, diceFace: 8, modifier: strMod)
                                }
                            }
                        }) {
                            HStack {
                                Image(systemName: "target").foregroundStyle(.red).padding(8).background(Color.red.opacity(0.1)).clipShape(Circle())
                                VStack(alignment: .leading) {
                                    Text("Standard Attack").bold()
                                    Text("ATK: 1d20+DEX+PROF   DMG: 1d8+STR").font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "arrow.right.circle.fill").foregroundStyle(.red)
                            }.padding().background(Color.white).cornerRadius(10).shadow(color: .black.opacity(0.05), radius: 1, y: 1)
                        }
                        
                        if character.isSpecialRuleEnabled {
                            ForEach(Array(character.breathingForms.enumerated()), id: \.element.id) { index, form in
                                BreathingActionRow(
                                    index: index,
                                    form: form,
                                    character: character,
                                    onTap: { handleFormUsage(index: index, form: form) }
                                )
                            }
                        }
                        ForEach(character.customActions.filter { $0.type == .main }) { action in CustomActionRow(action: action) }
                    }
                    
                    // Bonus Actions
                    ActionSection(title: "Bonus Actions", icon: "bolt.fill", color: .orange) {
                        Button(action: fullRestoreBreaths) {
                            HStack {
                                Image(systemName: "wind").foregroundStyle(.cyan).padding(8).background(Color.cyan.opacity(0.1)).clipShape(Circle())
                                VStack(alignment: .leading) {
                                    Text("Breathe In").bold().foregroundStyle(.primary)
                                    Text("Full Restore & Reset DC").font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "arrow.counterclockwise.circle.fill").foregroundStyle(.green)
                            }.padding().background(Color.white).cornerRadius(10).shadow(color: .black.opacity(0.05), radius: 1, y: 1)
                        }
                        ForEach(character.customActions.filter { $0.type == .bonus }) { action in CustomActionRow(action: action) }
                    }
                    
                    ActionSection(title: "Reactions", icon: "exclamationmark.shield.fill", color: .purple) {
                        ForEach(character.customActions.filter { $0.type == .reaction }) { action in CustomActionRow(action: action) }
                    }
                    ActionSection(title: "Free Actions", icon: "hand.wave.fill", color: .green) {
                        ForEach(character.customActions.filter { $0.type == .free }) { action in CustomActionRow(action: action) }
                    }
                }
                .padding(.bottom, 50)
            }
            .padding(.top)
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
    
    // Mechanics Logic
    func modifyBreaths(_ amount: Int) {
        character.currentBreaths = min(character.currentBreaths + amount, character.maxBreaths)
    }
    
    func clearAttackBuff() {
        character.activeBuffFormID = nil
        character.activeBuffName = nil
        character.activeBuffDiceCount = nil
        character.activeBuffDiceFace = nil
        character.activeBuffRoundsRemaining = nil
    }
    
    func consumeAttackBuffRound() {
        guard let rounds = character.activeBuffRoundsRemaining else { return }
        let next = rounds - 1
        character.activeBuffRoundsRemaining = next
        if next <= 0 { clearAttackBuff() }
    }
    
    func activateAttackBuff(from form: BreathingForm) {
        character.activeBuffFormID = form.id
        character.activeBuffName = form.name
        character.activeBuffDiceCount = form.diceCount
        character.activeBuffDiceFace = form.diceFace
        character.activeBuffRoundsRemaining = max(form.durationRounds, 1)
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }
    
    func fullRestoreBreaths() {
        character.currentBreaths = character.maxBreaths
        character.currentOverdraftDC = 15
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }
    
    func rollDamageWithBuff(title: String, diceCount: Int, diceFace: Int, modifier: Int) {
        if let buff = activeBuff {
            let groups = [
                CombinedDiceGroup(label: "Base", count: diceCount, face: diceFace),
                CombinedDiceGroup(label: buff.name, count: buff.count, face: buff.face)
            ]
            onCombinedRoll(title, groups, modifier) { _ in
                consumeAttackBuffRound()
            }
        } else {
            onRoll(title, diceCount, diceFace, modifier) { _ in }
        }
    }
    
    func handleFormUsage(index: Int, form: BreathingForm) {
        let cost = (index + 1) * 3
        character.currentBreaths -= cost
        
        // Compute mods and proficiency so they are in scope for nested closures
        func abilityMod(_ score: Int) -> Int { (score - 10) / 2 }
        let profBonus = (character.level - 1) / 4 + 2
        let dexMod = abilityMod(character.dexterity)
        let wisMod = abilityMod(character.wisdom)
        let strMod = abilityMod(character.strength)
        
        let performEffect: () -> Void = {
            if form.effectType == .attackBuff {
                let applyBuff = { activateAttackBuff(from: form) }
                if form.requiresAttackRoll {
                    let attackMod = dexMod + wisMod + profBonus
                    onRoll("\(form.name) Attack", 1, 20, attackMod) { _ in
                        onConfirmHit { applyBuff() }
                    }
                } else {
                    applyBuff()
                }
            } else {
                // Breathing form damage uses the form's configured dice, with WIS modifier
                let damageAction = {
                    rollDamageWithBuff(title: "\(form.name) Damage", diceCount: form.diceCount, diceFace: form.diceFace, modifier: wisMod)
                }
                // Breathing form attack roll uses 1d20 + DEX + WIS + PROF
                let attackMod = dexMod + wisMod + profBonus
                performAttackLogic(form: form, mod: attackMod, damageAction: damageAction)
            }
        }
        
        if character.currentBreaths < 0 {
            let saveMod = dexMod
            let dc = character.currentOverdraftDC
            
            onRoll("Overexertion Save (DC \(dc))", 1, 20, saveMod) { saveResult in
                character.currentOverdraftDC += 5
                
                if saveResult < dc {
                    let generator = UINotificationFeedbackGenerator()
                    generator.notificationOccurred(.error)
                    // CHAIN: Backlash -> Form with proper timing
                    onRoll("Backlash Damage", 2, 8, 0) { damage in
                        character.currentHP = max(0, character.currentHP - damage)
                        // Only perform effect if still conscious
                        if character.currentHP > 0 {
                            performEffect()
                        }
                    }
                } else {
                    let generator = UINotificationFeedbackGenerator()
                    generator.notificationOccurred(.success)
                    performEffect()
                }
            }
        } else {
            performEffect()
        }
    }
    
    func performAttackLogic(form: BreathingForm, mod: Int, damageAction: @escaping () -> Void) {
        if form.requiresAttackRoll {
            onRoll("\(form.name) Attack", 1, 20, mod) { _ in
                onConfirmHit(damageAction)
            }
        } else {
            damageAction()
        }
    }
}

// MARK: - COMBAT COMPONENTS

struct BreathingActionRow: View {
    let index: Int
    let form: BreathingForm
    let character: RPGCharacter
    let onTap: () -> Void
    
    var breathCost: Int { (index + 1) * 3 }
    var isRisk: Bool { return (character.currentBreaths - breathCost) < 0 }
    
    var body: some View {
        Button(action: onTap) {
            HStack {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(isRisk ? Color.red.opacity(0.15) : Color.orange.opacity(0.15))
                        .frame(width: 40, height: 40)
                    Image(systemName: isRisk ? "exclamationmark.triangle.fill" : "die.face.5.fill")
                        .foregroundStyle(isRisk ? .red : .orange)
                }
                VStack(alignment: .leading) {
                    Text(form.name).bold().foregroundStyle(.primary)
                    Text(form.description).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    HStack(spacing: 2) {
                        Image(systemName: "wind").font(.caption2)
                        Text("-\(breathCost)").font(.caption).bold()
                    }
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(isRisk ? Color.red.opacity(0.15) : Color.cyan.opacity(0.15))
                    .foregroundStyle(isRisk ? .red : .cyan)
                    .cornerRadius(6)
                    
                    if form.effectType == .damage {
                        Text("\(form.diceCount)d\(form.diceFace)").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
            .padding().background(Color.white).cornerRadius(10).shadow(color: .black.opacity(0.05), radius: 1, y: 1)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(isRisk ? Color.red.opacity(0.5) : Color.clear, lineWidth: 1))
        }
    }
}

struct CustomActionRow: View {
    let action: CombatAction
    var body: some View {
        HStack {
            Image(systemName: "circle.fill").font(.system(size: 6)).foregroundStyle(.gray).padding(.horizontal, 6)
            VStack(alignment: .leading) {
                Text(action.name).bold()
                if !action.description.isEmpty { Text(action.description).font(.caption).foregroundStyle(.secondary) }
            }
            Spacer()
        }
        .padding().background(Color.white).cornerRadius(10).shadow(color: .black.opacity(0.05), radius: 1, y: 1)
    }
}

struct ActionSection<Content: View>: View {
    let title: String
    let icon: String
    let color: Color
    @ViewBuilder var content: Content
    
    init(title: String, icon: String, color: Color, @ViewBuilder content: () -> Content) {
        self.title = title; self.icon = icon; self.color = color; self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: icon).foregroundStyle(color).padding(6).background(color.opacity(0.1)).clipShape(RoundedRectangle(cornerRadius: 6))
                Text(title).font(.headline)
                Spacer()
            }
            .padding(.horizontal)
            VStack(spacing: 8) { content }.padding(.horizontal)
        }
        .padding(.vertical, 12).background(Color.white).cornerRadius(12).shadow(color: .black.opacity(0.05), radius: 2, y: 1).padding(.horizontal)
    }
}

// MARK: - PAGE 2: INVENTORY PAGE
struct InventoryPage: View {
    let character: RPGCharacter
    var onAddItem: () -> Void
    var totalWeight: Double { character.inventory.reduce(0) { $0 + ($1.weight * Double($1.quantity)) } }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                VStack(spacing: 5) {
                    HStack {
                        Image(systemName: character.isEncumbered ? "scalemass.fill" : "scalemass")
                            .foregroundStyle(character.isEncumbered ? .red : .secondary)
                        Text("Weight Load").font(.caption).foregroundStyle(.secondary)
                        Spacer()
                        Text(String(format: "%.1f / %.1f lbs", totalWeight, character.maxWeight))
                            .font(.caption).bold().foregroundStyle(character.isEncumbered ? .red : .primary)
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4).fill(Color.gray.opacity(0.2))
                            RoundedRectangle(cornerRadius: 4).fill(character.isEncumbered ? Color.red : Color.blue)
                                .frame(width: min(CGFloat(totalWeight / character.maxWeight) * geo.size.width, geo.size.width))
                        }
                    }.frame(height: 6)
                }
                .padding(.horizontal).padding(.top, 10)
                
                VStack(spacing: 15) {
                    HStack {
                        Text("Inventory").font(.largeTitle).bold()
                        Spacer()
                        Button(action: onAddItem) {
                            Image(systemName: "plus").font(.title2).bold().foregroundStyle(.white)
                                .frame(width: 40, height: 40).background(Color.blue).clipShape(Circle()).shadow(radius: 3)
                        }
                    }
                    HStack {
                        HStack(spacing: 8) {
                            ZStack { Circle().fill(Color.yellow.opacity(0.2)).frame(width: 40, height: 40); Text("G").font(.headline).bold().foregroundStyle(.orange) }
                            VStack(alignment: .leading, spacing: 0) { Text("Gold").font(.caption).foregroundStyle(.secondary).textCase(.uppercase); Text("\(character.gold)").font(.title2).bold().fontDesign(.monospaced) }
                        }
                        Spacer()
                        HStack(spacing: 0) {
                            Button(action: { if character.gold >= 10 { character.gold -= 10 } }) { Text("-10").font(.caption).bold().padding(10) }; Divider().frame(height: 20)
                            Button(action: { if character.gold > 0 { character.gold -= 1 } }) { Text("-1").font(.caption).bold().padding(10) }; Divider().frame(height: 20)
                            Button(action: { character.gold += 1 }) { Text("+1").font(.caption).bold().padding(10) }; Divider().frame(height: 20)
                            Button(action: { character.gold += 10 }) { Text("+10").font(.caption).bold().padding(10) }
                        }.background(Color.gray.opacity(0.1)).cornerRadius(8)
                    }
                    .padding().background(Color.white).cornerRadius(12).shadow(color: .black.opacity(0.05), radius: 2, y: 1)
                }
                .padding(.horizontal).padding(.top)
                
                VStack(spacing: 12) {
                    if character.inventory.isEmpty {
                        VStack(spacing: 10) { Image(systemName: "backpack").font(.system(size: 50)).foregroundStyle(.gray.opacity(0.4)); Text("Inventory is empty").font(.headline).foregroundStyle(.gray) }.frame(maxWidth: .infinity).padding(.vertical, 50)
                    } else {
                        ForEach(character.inventory) { item in InventoryItemRow(item: item, character: character) }
                    }
                }
                .padding(.horizontal)
                
                if !character.inventory.isEmpty {
                    HStack {
                        Image(systemName: "scalemass").foregroundStyle(.secondary)
                        Text("Total Load:").foregroundStyle(.secondary)
                        Text(String(format: "%.1f lbs", totalWeight)).bold()
                    }.font(.caption).padding(.top, 10)
                }
                Spacer(minLength: 80)
            }
        }.background(Color(UIColor.systemGroupedBackground))
    }
}

struct InventoryItemRow: View {
    let item: InventoryItem
    let character: RPGCharacter
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack { RoundedRectangle(cornerRadius: 10).fill(Color.blue.opacity(0.1)).frame(width: 50, height: 50); Image(systemName: "cube.box.fill").foregroundStyle(.blue).font(.title2) }
            VStack(alignment: .leading, spacing: 4) {
                Text(item.name).font(.headline).lineLimit(1)
                if !item.description.isEmpty { Text(item.description).font(.caption).foregroundStyle(.secondary).lineLimit(2) }
                if item.weight > 0 { Text(String(format: "%.1f lb total", item.weight * Double(item.quantity))).font(.caption2).bold().foregroundStyle(.secondary).padding(.top, 2) }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 8) {
                HStack(spacing: 0) {
                    Button(action: { modifyQuantity(by: -1) }) { Image(systemName: "minus").font(.caption2).frame(width: 24, height: 24).background(Color.gray.opacity(0.1)).foregroundStyle(.primary) }
                    Text("\(item.quantity)").font(.caption).bold().frame(minWidth: 20).padding(.horizontal, 4).background(Color.gray.opacity(0.1))
                    Button(action: { modifyQuantity(by: 1) }) { Image(systemName: "plus").font(.caption2).frame(width: 24, height: 24).background(Color.gray.opacity(0.1)).foregroundStyle(.primary) }
                }.cornerRadius(6).overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.gray.opacity(0.2), lineWidth: 1))
                Button(action: deleteItem) { Image(systemName: "trash").font(.caption).foregroundStyle(.red.opacity(0.8)).padding(6).background(Color.red.opacity(0.1)).clipShape(Circle()) }
            }
        }.padding().background(Color.white).cornerRadius(12).shadow(color: .black.opacity(0.05), radius: 2, y: 1)
    }
    
    func modifyQuantity(by amount: Int) {
        if let index = character.inventory.firstIndex(where: { $0.id == item.id }) {
            character.inventory[index].quantity += amount
            if character.inventory[index].quantity <= 0 { character.inventory.remove(at: index) }
        }
    }
    func deleteItem() {
        if let index = character.inventory.firstIndex(where: { $0.id == item.id }) { withAnimation { character.inventory.remove(at: index) } }
    }
}

// MARK: - PAGE 3: BIO PAGE
struct BioPage: View {
    let character: RPGCharacter
    var onEdit: () -> Void
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                HStack { Text("Biography").font(.largeTitle).bold(); Spacer(); Button("Edit") { onEdit() }.bold() }.padding(.horizontal).padding(.top)
                VStack(spacing: 0) {
                    HStack { InfoCell(title: "Age", value: character.age); Divider(); InfoCell(title: "Height", value: character.height); Divider(); InfoCell(title: "Weight", value: character.weight) }
                    Divider()
                    HStack { InfoCell(title: "Eyes", value: character.eyes); Divider(); InfoCell(title: "Skin", value: character.skin); Divider(); InfoCell(title: "Hair", value: character.hair) }
                }.background(Color.white).cornerRadius(12).shadow(color: .black.opacity(0.05), radius: 2, y: 1).padding(.horizontal)
                
                VStack(alignment: .leading, spacing: 15) {
                    Text("Personality").font(.headline).padding(.leading, 5)
                    RoleplayBox(label: "Traits", text: character.personalityTraits, icon: "person.bubble.fill", color: .blue)
                    RoleplayBox(label: "Ideals", text: character.ideals, icon: "star.fill", color: .yellow)
                    RoleplayBox(label: "Bonds", text: character.bonds, icon: "link", color: .green)
                    RoleplayBox(label: "Flaws", text: character.flaws, icon: "exclamationmark.triangle.fill", color: .red)
                }.padding(.horizontal)
                
                VStack(alignment: .leading, spacing: 10) {
                    Label("Backstory", systemImage: "book.fill").font(.headline)
                    Text(character.backstory.isEmpty ? "No backstory written yet." : character.backstory).font(.body).foregroundStyle(character.backstory.isEmpty ? .secondary : .primary).frame(maxWidth: .infinity, alignment: .leading).padding().background(Color.white).cornerRadius(12).shadow(color: .black.opacity(0.05), radius: 2, y: 1)
                }.padding(.horizontal)
                Spacer(minLength: 80)
            }
        }.background(Color(UIColor.systemGroupedBackground))
    }
}

struct InfoCell: View {
    let title: String; let value: String
    var body: some View { VStack(spacing: 2) { Text(title).font(.caption).foregroundStyle(.secondary).textCase(.uppercase); Text(value.isEmpty ? "--" : value).font(.headline) }.frame(maxWidth: .infinity).padding(.vertical, 12).background(Color.white) }
}

struct RoleplayBox: View {
    let label: String; let text: String; let icon: String; let color: Color
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon).foregroundStyle(color).font(.title2).frame(width: 30).padding(.top, 2)
            VStack(alignment: .leading, spacing: 4) {
                Text(label).font(.caption).bold().foregroundStyle(color).textCase(.uppercase)
                Text(text.isEmpty ? "..." : text).font(.body).foregroundStyle(text.isEmpty ? .secondary : .primary).italic(text.isEmpty)
            }
        }.frame(maxWidth: .infinity, alignment: .leading).padding().background(Color.white).cornerRadius(12).shadow(color: .black.opacity(0.05), radius: 2, y: 1)
    }
}

// MARK: - PAGE 4: NOTES PAGE
struct NotesPage: View {
    let character: RPGCharacter
    var onEdit: () -> Void
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                HStack { Text("Campaign Notes").font(.largeTitle).bold(); Spacer(); Button("Edit") { onEdit() }.bold() }.padding(.horizontal).padding(.top)
                VStack(alignment: .leading) {
                    if character.notes.isEmpty {
                        VStack(spacing: 15) {
                            Image(systemName: "pencil.and.scribble").font(.system(size: 60)).foregroundStyle(.gray.opacity(0.3))
                            Text("No notes recorded.").font(.headline).foregroundStyle(.gray)
                            Text("Tap 'Edit' to add session logs, loot tracking, or secrets.").font(.caption).foregroundStyle(.gray).multilineTextAlignment(.center)
                        }.frame(maxWidth: .infinity).padding(.vertical, 80)
                    } else {
                        Text(character.notes).font(.body).frame(maxWidth: .infinity, alignment: .leading)
                    }
                }.padding().background(Color.white).cornerRadius(12).shadow(color: .black.opacity(0.05), radius: 2, y: 1).padding(.horizontal)
                Spacer(minLength: 80)
            }
        }.background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - HEALTH POPUP
struct HealthPopupView: View {
    let character: RPGCharacter
    var onClose: () -> Void
    var onRollSurge: () -> Void
    
    @State private var input = ""
    @State private var mode: Mode = .damage
    
    enum Mode { case damage, heal }
    
    var maxHP: Int { (8 + (character.constitution - 10) / 2) * character.level }
    
    var body: some View {
        VStack(spacing: 20) {
            // Header
            HStack {
                Text("Health Management").font(.headline).foregroundStyle(.secondary)
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark.circle.fill").font(.title2).foregroundStyle(.gray.opacity(0.5))
                }
            }
            
            // Health Display
            VStack(spacing: 5) {
                Text("\(character.currentHP) / \(maxHP)")
                    .font(.system(size: 40, weight: .bold, design: .rounded))
                    .foregroundStyle(character.currentHP < maxHP / 2 ? .red : .primary)
                Text("Current HP").font(.caption).bold().foregroundStyle(.secondary)
            }
            
            Divider()
            
            // Mode Toggle
            HStack(spacing: 0) {
                Button(action: { mode = .damage }) {
                    Text("Damage").bold()
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(mode == .damage ? Color.red : Color.gray.opacity(0.1))
                        .foregroundStyle(mode == .damage ? .white : .primary)
                }
                Button(action: { mode = .heal }) {
                    Text("Heal").bold()
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(mode == .heal ? Color.green : Color.gray.opacity(0.1))
                        .foregroundStyle(mode == .heal ? .white : .primary)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 12))
            
            // Input & Numpad
            VStack(spacing: 15) {
                Text(input.isEmpty ? "0" : input)
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(mode == .damage ? .red : .green)
                    .frame(height: 40)
                
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 10) {
                    ForEach(1...9, id: \.self) { num in
                        numpadButton("\(num)")
                    }
                    Button(action: { input = "" }) {
                        Image(systemName: "trash").font(.title2).frame(maxWidth: .infinity, maxHeight: .infinity)
                            .padding(.vertical, 15).background(Color.gray.opacity(0.1)).cornerRadius(8).foregroundStyle(.primary)
                    }
                    numpadButton("0")
                    Button(action: { if !input.isEmpty { input.removeLast() } }) {
                        Image(systemName: "delete.left").font(.title2).frame(maxWidth: .infinity, maxHeight: .infinity)
                            .padding(.vertical, 15).background(Color.gray.opacity(0.1)).cornerRadius(8).foregroundStyle(.primary)
                    }
                }
                
                Button(action: applyChange) {
                    Text("Apply \(mode == .damage ? "Damage" : "Healing")")
                        .font(.headline).bold().foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding()
                        .background(mode == .damage ? Color.red : Color.green)
                        .cornerRadius(12)
                }.disabled(input.isEmpty)
            }
            
            Divider()
            
            // Healing Surge
            Button(action: { onRollSurge(); onClose() }) {
                HStack {
                    Image(systemName: "cross.circle.fill").foregroundStyle(.purple)
                    VStack(alignment: .leading) {
                        Text("Use Healing Surge").bold().foregroundStyle(.primary)
                        Text("Heals 1d12").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text("\(character.healingSurges) left").font(.subheadline).bold()
                        .foregroundStyle(character.healingSurges > 0 ? .primary : Color.red)
                }
                .padding()
                .background(Color.purple.opacity(0.1))
                .cornerRadius(12)
            }
            .disabled(character.healingSurges <= 0)
            .opacity(character.healingSurges <= 0 ? 0.6 : 1)
        }
        .padding(24)
        .background(Color(UIColor.systemBackground))
        .cornerRadius(20)
        .shadow(radius: 20)
        .padding(24)
    }
    
    func numpadButton(_ val: String) -> some View {
        Button(action: { if input.count < 4 { input += val } }) {
            Text(val).font(.title2).bold()
                .frame(maxWidth: .infinity).padding(.vertical, 15)
                .background(Color.gray.opacity(0.1)).cornerRadius(8).foregroundStyle(.primary)
        }
    }
    
    func applyChange() {
        guard let amount = Int(input) else { return }
        if mode == .damage {
            character.currentHP = max(character.currentHP - amount, 0)
        } else {
            character.currentHP = min(character.currentHP + amount, maxHP)
        }
        onClose()
    }
}
