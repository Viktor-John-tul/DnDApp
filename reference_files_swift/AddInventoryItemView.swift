import SwiftUI

struct AddInventoryItemView: View {
    @Environment(\.dismiss) var dismiss
    var onSave: (InventoryItem) -> Void
    
    @State private var name = ""
    @State private var description = ""
    @State private var quantity = 1
    @State private var weight = 0.0 // NEW
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Item Details") {
                    TextField("Item Name (e.g. Greatsword)", text: $name)
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }
                
                Section("Stats") {
                    Stepper(value: $quantity, in: 1...99) {
                        HStack {
                            Text("Quantity")
                            Spacer()
                            Text("\(quantity)").bold()
                        }
                    }
                    
                    // NEW: WEIGHT STEPPER (0.0 to 100.0)
                    Stepper(value: $weight, in: 0...500, step: 0.5) {
                        HStack {
                            Text("Weight (per item)")
                            Spacer()
                            Text(String(format: "%.1f", weight)).bold() // Format to 1 decimal
                        }
                    }
                }
            }
            .navigationTitle("Add Item")
            .toolbar {
                Button("Save") {
                    let newItem = InventoryItem(name: name, description: description, quantity: quantity, weight: weight)
                    onSave(newItem)
                    dismiss()
                }
                .disabled(name.isEmpty)
            }
        }
    }
}
