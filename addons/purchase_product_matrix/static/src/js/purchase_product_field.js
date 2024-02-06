/** @odoo-module **/

import { registry } from '@web/core/registry';
import { Many2OneField } from '@web/views/fields/many2one/many2one_field';
import { ProductMatrixDialog } from "@product_matrix/js/product_matrix_dialog";
import { useEffect } from '@odoo/owl';


export class PurchaseOrderLineProductField extends Many2OneField {

    setup() {
        super.setup();
        let isMounted = false;
        let isInternalUpdate = false;
        const super_update = this.update;
        this.update = (recordlist) => {
            isInternalUpdate = true;
            super_update(recordlist);
        };
        if (this.props.canQuickCreate) {
            this.quickCreate = (name, params = {}) => {
                if (params.triggeredOnBlur) {
                    return this.openConfirmationDialog(name);
                }
                isInternalUpdate = true;
                return this.props.update([false, name]);
            };
        }
        useEffect(value => {
            if (!isMounted) {
                isMounted = true;
            } else if (value && isInternalUpdate) {
                // we don't want to trigger product update when update comes from an external sources,
                // such as an onchange, or the product configuration dialog itself
                this._onProductTemplateUpdate();
            }
            isInternalUpdate = false;
        }, () => [Array.isArray(this.value) && this.value[0]]);
    }

    get configurationButtonHelp() {
        return this.env._t("Edit Configuration");
    }
    get isConfigurableTemplate() {
        return this.props.record.data.is_configurable_product;
    }

    async _onProductTemplateUpdate() {
        const result = await this.orm.call(
            'product.template',
            'get_single_product_variant',
            [this.props.record.data.product_template_id[0]],
        );
        if(result && result.product_id) {
            if (this.props.record.data.product_id != result.product_id.id) {
                this.props.record.update({
                    // TODO right name get (same problem as configurator)
                    product_id: [result.product_id, 'whatever'],
                });
            }
        } else {
            this._openGridConfigurator(false);
        }
    }

    onEditConfiguration() {
        if (this.props.record.data.is_configurable_product) {
            this._openGridConfigurator(true);
        }
    }

    async _openGridConfigurator(edit) {
        const PurchaseOrderRecord = this.props.record.model.root;

        // fetch matrix information from server;
        await PurchaseOrderRecord.update({
            grid_product_tmpl_id: this.props.record.data.product_template_id,
        });

        let updatedLineAttributes = [];
        if (edit) {
            // provide attributes of edited line to automatically focus on matching cell in the matrix
            for (let ptnvav of this.props.record.data.product_no_variant_attribute_value_ids.records) {
                updatedLineAttributes.push(ptnvav.data.id);
            }
            for (let ptav of this.props.record.data.product_template_attribute_value_ids.records) {
                updatedLineAttributes.push(ptav.data.id);
            }
            updatedLineAttributes.sort((a, b) => { return a - b; });
        }

        this._openMatrixConfigurator(
            PurchaseOrderRecord.data.grid,
            this.props.record.data.product_template_id[0],
            updatedLineAttributes,
        );

        if (!edit) {
            // remove new line used to open the matrix
            PurchaseOrderRecord.data.order_line.removeRecord(this.props.record);
        }
    }

    _openMatrixConfigurator(jsonInfo, productTemplateId, editedCellAttributes) {
        const infos = JSON.parse(jsonInfo);
        this.dialog.add(ProductMatrixDialog, {
            header: infos.header,
            rows: infos.matrix,
            editedCellAttributes: editedCellAttributes.toString(),
            product_template_id: productTemplateId,
            record: this.props.record.model.root,
        });
    }
}

PurchaseOrderLineProductField.template = "purchase.PurchaseProductField";

registry.category("fields").add("pol_product_many2one", PurchaseOrderLineProductField);
